import { Component, Input, NgModule, AfterViewInit, HostListener, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { HotkeysService, ConfigService } from 'tabby-core';
import { MinimizedDialogManagerService } from '../services/minimizedDialogManager.service';

/**
 * Dialog component for confirming command execution
 */
@Component({
  templateUrl: './confirmCommandDialog.component.pug',
  styles: [`
    .character-highlighting {
      font-family: 'Courier New', monospace;
      font-size: 1.1em;
      line-height: 1.5;
      padding: 8px;
      background-color: #f8f9fa;
      border-radius: 4px;
      border: 1px solid #dee2e6;
    }

    .character {
      display: inline-block;
      padding: 2px 1px;
      margin: 0;
      border-radius: 2px;
      transition: all 0.2s ease;
    }

    .char-correct {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .char-incorrect {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      animation: shake 0.3s ease-in-out;
    }

    .char-pending {
      background-color: #fff3cd;
      color: #856404;
      border: 1px solid #ffeaa7;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-2px); }
      75% { transform: translateX(2px); }
    }

    .typing-metrics {
      background-color: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #dee2e6;
    }

    .typing-speed {
      padding: 5px;
    }

    .character-progress {
      font-size: 0.9em;
    }

    .auto-completed {
      animation: autoCompleteFlash 0.5s ease-in-out;
      border-color: #28a745 !important;
      box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.25) !important;
    }

    @keyframes autoCompleteFlash {
      0% { background-color: #d4edda; }
      50% { background-color: #c3e6cb; }
      100% { background-color: transparent; }
    }
  `]
})
export class ConfirmCommandDialogComponent implements AfterViewInit, OnDestroy {
  @Input() command: string;
  @Input() tabId: number;
  @Input() tabTitle: string;
  @Input() commandExplanation: string;

  // Flag to show/hide reject input form
  showRejectInput = false;

  // Rejection message
  rejectMessage: string = '';

  // Reference to the reject message textarea
  @ViewChild('rejectMessageTextarea') rejectMessageTextareaRef: ElementRef<HTMLTextAreaElement>;

  // Retype functionality properties
  showRetypeInput = false;
  retypeValue = '';
  retypeValid = false;
  retypeTarget = '';

  // Progressive confirmation and bypass properties
  retypeAttempts = 0;
  showBypassOption = false;
  bypassRequested = false;
  retypeHints: string[] = [];
  partialMatchScore = 0;

  // Phase 2 enhancement properties
  characterStates: ('correct' | 'incorrect' | 'pending')[] = [];
  typingStartTime: number = 0;
  typingSpeed = 0; // characters per minute
  lastTypingTime = 0;

  // Double Enter bypass properties
  firstEnterPressed = false;
  firstEnterTime = 0;
  showDoubleEnterHint = false;
  doubleEnterTimeout: any = null;

  // Keyboard focus tracking
  retypeInputHasFocus = false;

  // Tab auto-completion properties
  lastAutoCompletionLength = 0;
  autoCompletionOccurred = false;

  // Reference to the retype input field
  @ViewChild('retypeInput') retypeInputRef: ElementRef<HTMLInputElement>;

  // Track if hotkeys are paused
  private hotkeysPaused = false;

  // Dialog ID for minimize/restore functionality
  public dialogId: string = '';

  constructor(
    public modal: NgbActiveModal,
    private hotkeysService: HotkeysService,
    private minimizedDialogManager: MinimizedDialogManagerService,
    private config: ConfigService
  ) {
    this.dialogId = this.minimizedDialogManager.generateDialogId();
  }

  /**
   * After view init, pause hotkeys and set up focus management
   */
  ngAfterViewInit(): void {
    setTimeout(() => {
      // Pause hotkeys while dialog is open
      this.pauseHotkeys();

      // Focus the dialog element to capture keyboard events
      if (this.modal) {
        const modalElement = document.querySelector('.modal-content') as HTMLElement;
        if (modalElement) {
          // Add tabindex to make the modal focusable
          if (!modalElement.hasAttribute('tabindex')) {
            modalElement.setAttribute('tabindex', '-1');
          }

          // Add focused class for visual indication
          modalElement.classList.add('focused');

          // Focus the modal
          modalElement.focus();

          // Add event listener to prevent focus from leaving the modal
          document.addEventListener('focusin', this.keepFocusInModal);
        }
      }

      // Initialize retype functionality
      this.initializeRetypeFeature();
    }, 100);
  }

  /**
   * Event handler to keep focus inside the modal
   */
  private keepFocusInModal = (event: FocusEvent) => {
    const modalElement = document.querySelector('.modal-content') as HTMLElement;
    if (modalElement && !modalElement.contains(event.target as Node)) {
      // If focus is outside the modal, bring it back
      modalElement.focus();
    }
  }

  /**
   * Pause hotkeys when the dialog is focused
   */
  pauseHotkeys(): void {
    if (!this.hotkeysPaused) {
      this.hotkeysService.disable();
      this.hotkeysPaused = true;
    }
  }

  /**
   * Restore hotkeys when the dialog is closed
   */
  resumeHotkeys(): void {
    if (this.hotkeysPaused) {
      this.hotkeysService.enable();
      this.hotkeysPaused = false;
    }
  }

  /**
   * Handle escape key to close dialog
   */
  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    const modalElement = document.querySelector('.modal-content') as HTMLElement;
    if (modalElement) {
      if (document.activeElement !== modalElement) {
        modalElement.focus();
        return;
      }
    }
    // Reset double Enter state when escaping
    this.resetDoubleEnterState();
    this.cancel();
  }

  /**
   * Handle enter key to confirm with double Enter bypass support
   */
  @HostListener('document:keydown.enter', ['$event'])
  onEnterPressed(event: KeyboardEvent): void {
    // Only handle if not in textarea
    if (!(event.target instanceof HTMLTextAreaElement)) {
      if (this.showRejectInput) {
        // If reject form is shown, confirm rejection
        if (this.rejectMessage.trim()) {
          this.reject();
        }
      } else if (this.showRetypeInput && !this.canExecuteCommand()) {
        // Handle double Enter bypass for retype validation
        this.handleDoubleEnterBypass();
      } else {
        // Otherwise confirm execution normally
        this.confirm();
      }
    }
  }

  /**
   * Handle 'r' key to show reject form
   */
  @HostListener('document:keydown.r', ['$event'])
  onRKeyPressed(event: KeyboardEvent): void {
    // Only handle if not in textarea, not in retype input, and reject form not shown
    if (!(event.target instanceof HTMLTextAreaElement) &&
        !this.isRetypeInputFocused() &&
        !this.showRejectInput) {
      this.showRejectForm();
    }
  }

  /**
   * Handle Tab key for auto-completion
   */
  @HostListener('document:keydown.tab', ['$event'])
  onTabPressed(event: KeyboardEvent): void {
    // Only handle if retype input is focused and auto-completion is enabled
    if (this.isRetypeInputFocused() && this.showRetypeInput) {
      const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
      const autoCompletionEnabled = pairProgrammingMode?.enableTabAutoCompletion !== false;

      if (autoCompletionEnabled && this.canAutoComplete()) {
        event.preventDefault(); // Prevent tab from changing focus
        this.performAutoCompletion();
      }
    }
  }

  /**
   * Handle keydown events in the textarea
   * @param event Keyboard event
   */
  onTextareaKeyDown(event: KeyboardEvent): void {
    // Handle Shift+Enter to add a new line
    if (event.key === 'Enter' && event.shiftKey) {
      // Let the default behavior happen (add a new line)
      return;
    }

    // Handle Enter to submit the form
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.reject();
    }
  }

  /**
   * Confirm command execution with progressive confirmation
   */
  confirm(): void {
    // Reset double Enter state when confirming normally
    this.resetDoubleEnterState();

    // Check if retype validation is required and passed
    if (!this.canExecuteCommand()) {
      this.handleFailedRetypeAttempt();
      return;
    }

    // If bypass was requested, log it for audit purposes
    if (this.bypassRequested) {
      this.logBypassAttempt('button');
    }

    this.resumeHotkeys();
    this.modal.close({ confirmed: true });
  }

  /**
   * Handle failed retype attempt with progressive confirmation
   */
  private handleFailedRetypeAttempt(): void {
    this.retypeAttempts++;

    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    const allowBypass = pairProgrammingMode?.allowRetypeBypass !== false;
    const bypassThreshold = pairProgrammingMode?.bypassAfterAttempts || 2;

    // Show bypass option if enabled and threshold reached
    if (allowBypass && this.retypeAttempts >= bypassThreshold) {
      this.showBypassOption = true;
    }

    // Focus the retype input
    if (this.retypeInputRef?.nativeElement) {
      this.retypeInputRef.nativeElement.focus();
    }
  }

  /**
   * Execute command with bypass (skip retype validation)
   */
  executeWithBypass(): void {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    const requiresConfirmation = pairProgrammingMode?.bypassRequiresConfirmation !== false;

    if (requiresConfirmation && !this.bypassRequested) {
      // First click - show confirmation
      this.bypassRequested = true;
      return;
    }

    // Execute with bypass
    this.logBypassAttempt('button');
    this.resumeHotkeys();
    this.modal.close({ confirmed: true, bypassed: true, bypassMethod: 'button' });
  }

  /**
   * Handle double Enter bypass logic
   */
  private handleDoubleEnterBypass(): void {
    const now = Date.now();
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    const allowBypass = pairProgrammingMode?.allowRetypeBypass !== false;

    if (!allowBypass) {
      // If bypass is disabled, just focus the retype input
      if (this.retypeInputRef?.nativeElement) {
        this.retypeInputRef.nativeElement.focus();
      }
      return;
    }

    if (!this.firstEnterPressed) {
      // First Enter press
      this.firstEnterPressed = true;
      this.firstEnterTime = now;
      this.showDoubleEnterHint = true;

      // Set timeout to reset the double Enter state
      this.doubleEnterTimeout = setTimeout(() => {
        this.resetDoubleEnterState();
      }, 2000); // 2 second window

    } else {
      // Second Enter press - check timing
      const timeDiff = now - this.firstEnterTime;

      if (timeDiff <= 2000) { // Within 2 seconds
        // Execute double Enter bypass
        this.executeDoubleEnterBypass();
      } else {
        // Too much time passed, reset and start over
        this.resetDoubleEnterState();
        this.handleDoubleEnterBypass(); // Recursive call to handle as first press
      }
    }
  }

  /**
   * Execute command with double Enter bypass
   */
  private executeDoubleEnterBypass(): void {
    this.resetDoubleEnterState();
    this.logBypassAttempt('double-enter');
    this.resumeHotkeys();
    this.modal.close({ confirmed: true, bypassed: true, bypassMethod: 'double-enter' });
  }

  /**
   * Reset double Enter bypass state
   */
  private resetDoubleEnterState(): void {
    this.firstEnterPressed = false;
    this.firstEnterTime = 0;
    this.showDoubleEnterHint = false;

    if (this.doubleEnterTimeout) {
      clearTimeout(this.doubleEnterTimeout);
      this.doubleEnterTimeout = null;
    }
  }

  /**
   * Log bypass attempt for audit purposes
   */
  private logBypassAttempt(method: string = 'button'): void {
    console.warn('Retype validation bypassed', {
      command: this.command,
      attempts: this.retypeAttempts,
      partialMatchScore: this.partialMatchScore,
      bypassMethod: method,
      timestamp: new Date().toISOString(),
      tabId: this.tabId,
      tabTitle: this.tabTitle
    });
  }

  /**
   * Show the reject form
   */
  showRejectForm(): void {
    this.showRejectInput = true;

    // Focus the textarea after it's shown
    setTimeout(() => {
      if (this.rejectMessageTextareaRef?.nativeElement) {
        this.rejectMessageTextareaRef.nativeElement.focus();
      }
    }, 100);
  }

  /**
   * Reject command execution with a reason
   */
  reject(): void {
    if (!this.rejectMessage.trim()) {
      // If no reason provided, ask for one
      alert('Please provide a reason for rejection.');
      return;
    }

    this.resumeHotkeys();
    this.modal.close({
      confirmed: false,
      rejected: true,
      rejectMessage: this.rejectMessage
    });
  }

  /**
   * Minimize the dialog
   */
  minimize(): void {
    console.log('Minimizing confirm command dialog');
    
    // We need to get the promise resolver from the DialogManagerService before dismissing
    // Since we can't access it directly, we'll use a different approach
    // Store a temporary reference that the DialogManagerService can access
    (this.modal as any)._mcpPromiseResolver = null; // Will be set by DialogManagerService
    
    // Create minimized dialog object
    const minimizedDialog = {
      id: this.dialogId,
      title: `Command: ${this.command.length > 40 ? this.command.substring(0, 40) + '...' : this.command}`,
      component: ConfirmCommandDialogComponent,
      instance: this,
      modalRef: this.modal,
      timestamp: Date.now()
      // promiseResolver will be set by DialogManagerService
    };
    
    // Add to minimized dialogs
    this.minimizedDialogManager.minimizeDialog(minimizedDialog);
    
    // Dismiss the modal with 'minimized' reason
    this.resumeHotkeys();
    this.modal.dismiss('minimized');
  }

  /**
   * Cancel command execution
   */
  cancel(): void {
    this.resumeHotkeys();
    this.modal.close({ confirmed: false });
  }

  /**
   * Initialize retype functionality based on configuration
   */
  initializeRetypeFeature(): void {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    if (pairProgrammingMode?.requireRetype) {
      this.showRetypeInput = true;
      this.setupRetypeTarget();

      // Focus the retype input after it's shown
      setTimeout(() => {
        if (this.retypeInputRef?.nativeElement) {
          this.retypeInputRef.nativeElement.focus();
        }
      }, 150);
    }
  }

  /**
   * Setup the target text that needs to be retyped
   */
  setupRetypeTarget(): void {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    const retypeMode = pairProgrammingMode?.retypeMode || 'partial';
    const retypeThreshold = pairProgrammingMode?.retypeThreshold || 10;

    switch (retypeMode) {
      case 'full':
        this.retypeTarget = this.command;
        break;
      case 'partial':
        this.retypeTarget = this.command.substring(0, Math.min(retypeThreshold, this.command.length));
        break;
      case 'keywords':
        // For now, extract first word and any flags (starting with -)
        const parts = this.command.split(' ');
        const keywords = parts.filter(part => part.startsWith('-') || part === parts[0]);
        this.retypeTarget = keywords.join(' ');
        break;
      default:
        this.retypeTarget = this.command.substring(0, Math.min(retypeThreshold, this.command.length));
    }
  }

  /**
   * Validate the retyped text with enhanced feedback
   */
  validateRetype(): void {
    if (!this.retypeTarget) {
      this.retypeValid = false;
      this.partialMatchScore = 0;
      this.retypeHints = [];
      this.characterStates = [];
      return;
    }

    // Reset auto-completion state if user is typing manually
    if (!this.autoCompletionOccurred) {
      this.lastAutoCompletionLength = 0;
    }

    // Update typing speed if enabled
    this.updateTypingSpeed();

    // Perform validation with case sensitivity option
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    const caseInsensitive = pairProgrammingMode?.caseInsensitiveMatching === true;

    if (caseInsensitive) {
      this.retypeValid = this.retypeValue.toLowerCase() === this.retypeTarget.toLowerCase();
    } else {
      this.retypeValid = this.retypeValue === this.retypeTarget;
    }

    // Calculate character-by-character states for highlighting
    this.calculateCharacterStates(caseInsensitive);

    // Calculate partial match score and generate hints
    this.calculatePartialMatch();
    this.generateRetypeHints();
  }

  /**
   * Calculate character-by-character states for highlighting
   */
  private calculateCharacterStates(caseInsensitive: boolean): void {
    this.characterStates = [];

    if (!this.retypeValue || !this.retypeTarget) {
      return;
    }

    const typed = this.retypeValue;
    const target = this.retypeTarget;

    for (let i = 0; i < target.length; i++) {
      if (i < typed.length) {
        // Character has been typed
        const typedChar = caseInsensitive ? typed[i].toLowerCase() : typed[i];
        const targetChar = caseInsensitive ? target[i].toLowerCase() : target[i];

        this.characterStates[i] = typedChar === targetChar ? 'correct' : 'incorrect';
      } else {
        // Character not yet typed
        this.characterStates[i] = 'pending';
      }
    }
  }

  /**
   * Update typing speed calculation
   */
  private updateTypingSpeed(): void {
    const now = Date.now();

    if (this.retypeValue.length === 1 && this.typingStartTime === 0) {
      // First character typed
      this.typingStartTime = now;
      this.lastTypingTime = now;
    } else if (this.retypeValue.length > 0 && this.typingStartTime > 0) {
      // Calculate typing speed (characters per minute)
      const timeElapsed = (now - this.typingStartTime) / 1000 / 60; // minutes
      if (timeElapsed > 0) {
        this.typingSpeed = Math.round(this.retypeValue.length / timeElapsed);
      }
      this.lastTypingTime = now;
    }

    if (this.retypeValue.length === 0) {
      // Reset when input is cleared
      this.typingStartTime = 0;
      this.typingSpeed = 0;
      this.lastTypingTime = 0;
    }
  }

  /**
   * Calculate partial match score for progressive feedback
   */
  private calculatePartialMatch(): void {
    if (!this.retypeValue || !this.retypeTarget) {
      this.partialMatchScore = 0;
      return;
    }

    // Count correct characters from character states
    const correctChars = this.characterStates.filter(state => state === 'correct').length;
    this.partialMatchScore = Math.round((correctChars / this.retypeTarget.length) * 100);
  }

  /**
   * Generate helpful hints based on current input
   */
  private generateRetypeHints(): void {
    this.retypeHints = [];

    if (!this.retypeValue || !this.retypeTarget) {
      return;
    }

    const typed = this.retypeValue;
    const target = this.retypeTarget;

    if (typed.length === 0) {
      this.retypeHints.push(`Start with: "${target.substring(0, Math.min(3, target.length))}..."`);
    } else if (this.partialMatchScore > 0) {
      const correctPart = target.substring(0, typed.length);
      if (typed === correctPart) {
        if (typed.length < target.length) {
          const nextChar = target[typed.length];
          this.retypeHints.push(`Next character: "${nextChar}"`);
        }
      } else {
        // Find first mismatch
        for (let i = 0; i < Math.min(typed.length, target.length); i++) {
          if (typed[i] !== target[i]) {
            this.retypeHints.push(`Character ${i + 1} should be "${target[i]}" not "${typed[i]}"`);
            break;
          }
        }
      }
    } else {
      this.retypeHints.push(`Expected: "${target}"`);
    }
  }

  /**
   * Get the target text for display
   */
  getRetypeTarget(): string {
    return this.retypeTarget;
  }

  /**
   * Check if command execution should be allowed
   */
  canExecuteCommand(): boolean {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    if (pairProgrammingMode?.requireRetype) {
      return this.retypeValid;
    }
    return true;
  }

  /**
   * Get character highlighting data for template
   */
  getCharacterHighlighting(): { char: string; state: string }[] {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    const highlightingEnabled = pairProgrammingMode?.enableCharacterHighlighting !== false;

    if (!highlightingEnabled || !this.retypeTarget) {
      return [];
    }

    return this.retypeTarget.split('').map((char, index) => ({
      char,
      state: this.characterStates[index] || 'pending'
    }));
  }

  /**
   * Check if typing metrics should be shown
   */
  shouldShowTypingMetrics(): boolean {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    return pairProgrammingMode?.showTypingMetrics !== false;
  }

  /**
   * Check if typing speed should be shown
   */
  shouldShowTypingSpeed(): boolean {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    return pairProgrammingMode?.enableTypingSpeed === true;
  }

  /**
   * Get typing speed display text
   */
  getTypingSpeedText(): string {
    if (this.typingSpeed === 0) {
      return 'Start typing...';
    }
    return `${this.typingSpeed} CPM`;
  }

  /**
   * Get count of correct characters
   */
  getCorrectCharacterCount(): number {
    if (!this.characterStates || this.characterStates.length === 0) {
      return 0;
    }
    return this.characterStates.filter(state => state === 'correct').length;
  }

  /**
   * Get count of incorrect characters
   */
  getIncorrectCharacterCount(): number {
    if (!this.characterStates || this.characterStates.length === 0) {
      return 0;
    }
    return this.characterStates.filter(state => state === 'incorrect').length;
  }

  /**
   * Get count of pending characters
   */
  getPendingCharacterCount(): number {
    if (!this.characterStates || this.characterStates.length === 0) {
      return 0;
    }
    return this.characterStates.filter(state => state === 'pending').length;
  }

  /**
   * Handle retype input focus
   */
  onRetypeFocus(): void {
    this.retypeInputHasFocus = true;
  }

  /**
   * Handle retype input blur
   */
  onRetypeBlur(): void {
    this.retypeInputHasFocus = false;
  }

  /**
   * Handle input events for retype field
   */
  onRetypeInput(): void {
    // This is called on manual typing, not auto-completion
    this.autoCompletionOccurred = false;
    this.validateRetype();
  }

  /**
   * Check if double Enter hint should be shown
   */
  shouldShowDoubleEnterHint(): boolean {
    return this.showDoubleEnterHint && this.showRetypeInput && !this.canExecuteCommand();
  }

  /**
   * Check if retype input is currently focused
   */
  isRetypeInputFocused(): boolean {
    return this.retypeInputRef?.nativeElement === document.activeElement;
  }

  /**
   * Check if auto-completion is possible
   */
  canAutoComplete(): boolean {
    if (!this.retypeValue || !this.retypeTarget) {
      return false;
    }

    // Don't auto-complete if already fully typed
    if (this.retypeValue.length >= this.retypeTarget.length) {
      return false;
    }

    // Check if current input is a valid prefix of the target
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    const caseInsensitive = pairProgrammingMode?.caseInsensitiveMatching === true;

    const currentInput = caseInsensitive ? this.retypeValue.toLowerCase() : this.retypeValue;
    const targetPrefix = caseInsensitive ?
      this.retypeTarget.substring(0, this.retypeValue.length).toLowerCase() :
      this.retypeTarget.substring(0, this.retypeValue.length);

    return currentInput === targetPrefix;
  }

  /**
   * Perform smart auto-completion
   */
  performAutoCompletion(): void {
    if (!this.canAutoComplete()) {
      return;
    }

    const completionText = this.getAutoCompletionText();
    if (completionText) {
      const previousLength = this.retypeValue.length;
      this.retypeValue = completionText;
      this.lastAutoCompletionLength = completionText.length - previousLength;
      this.autoCompletionOccurred = true;

      // Update validation state
      this.validateRetype();

      // Provide visual feedback
      this.showAutoCompletionFeedback();

      // Reset auto-completion flag after a short delay
      setTimeout(() => {
        this.autoCompletionOccurred = false;
      }, 1000);
    }
  }

  /**
   * Get the text to auto-complete to
   */
  private getAutoCompletionText(): string {
    if (!this.retypeValue || !this.retypeTarget) {
      return '';
    }

    const currentLength = this.retypeValue.length;
    const remaining = this.retypeTarget.substring(currentLength);

    // Find the next word boundary or complete to end
    const nextSpaceIndex = remaining.indexOf(' ');

    if (nextSpaceIndex === -1) {
      // No more spaces, complete to end
      return this.retypeTarget;
    } else {
      // Complete to next word boundary (including the space)
      return this.retypeTarget.substring(0, currentLength + nextSpaceIndex + 1);
    }
  }

  /**
   * Show visual feedback for auto-completion
   */
  private showAutoCompletionFeedback(): void {
    // Add a temporary class to the input for visual feedback
    if (this.retypeInputRef?.nativeElement) {
      const element = this.retypeInputRef.nativeElement;
      element.classList.add('auto-completed');

      // Remove the class after animation
      setTimeout(() => {
        element.classList.remove('auto-completed');
      }, 500);
    }
  }

  /**
   * Check if tab auto-completion is enabled
   */
  isTabAutoCompletionEnabled(): boolean {
    const pairProgrammingMode = this.config.store.mcp?.pairProgrammingMode;
    return pairProgrammingMode?.enableTabAutoCompletion !== false;
  }

  /**
   * Get auto-completion hint text
   */
  getAutoCompletionHint(): string {
    if (!this.isTabAutoCompletionEnabled() || !this.canAutoComplete()) {
      return '';
    }

    const completionText = this.getAutoCompletionText();
    const remaining = completionText.substring(this.retypeValue.length);
    const nextWord = remaining.split(' ')[0];

    if (nextWord) {
      return `Press Tab to complete: "${nextWord}"`;
    } else {
      return 'Press Tab to complete command';
    }
  }

  /**
   * Clean up when component is destroyed
   */
  ngOnDestroy(): void {
    this.resumeHotkeys();

    // Clean up double Enter timeout
    this.resetDoubleEnterState();

    // Remove the focus event listener
    document.removeEventListener('focusin', this.keepFocusInModal);

    // Remove focused class from modal if it exists
    const modalElement = document.querySelector('.modal-content') as HTMLElement;
    if (modalElement) {
      modalElement.classList.remove('focused');
    }
  }
}

/**
 * Module for ConfirmCommandDialogComponent
 * This allows the component to be used with NgModel
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule
  ],
  declarations: [
    ConfirmCommandDialogComponent
  ],
  exports: [
    ConfirmCommandDialogComponent
  ],
  // HotkeysService is provided at the root level
})
export class ConfirmCommandDialogModule { }
