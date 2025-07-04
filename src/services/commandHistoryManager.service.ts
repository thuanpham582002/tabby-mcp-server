import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { McpLoggerService } from './mcpLogger.service';

/**
 * Interface for command history entry
 */
export interface CommandHistoryEntry {
  id: string;
  command: string;
  output: string;
  dir: string | null; // current working directory where command was executed
  exitCode: number | null;
  timestamp: number;
  aborted: boolean;
  tabId: string;
  tabTitle?: string;
  duration?: number; // execution duration in milliseconds
}

/**
 * Service to manage command execution history
 */
@Injectable({ providedIn: 'root' })
export class CommandHistoryManagerService {
  private readonly MAX_HISTORY_ENTRIES = 1000;
  private commandHistory = new BehaviorSubject<CommandHistoryEntry[]>([]);
  
  /** Observable for command history */
  get commandHistory$(): Observable<CommandHistoryEntry[]> {
    return this.commandHistory.asObservable();
  }

  /** Get current command history */
  get history(): CommandHistoryEntry[] {
    return this.commandHistory.value;
  }

  constructor(private logger: McpLoggerService) {
    this.logger.info('CommandHistoryManagerService initialized');
    this.loadHistoryFromStorage();
  }

  /**
   * Add a command to history
   */
  addCommand(entry: Omit<CommandHistoryEntry, 'id'>): string {
    const id = this.generateEntryId();
    const historyEntry: CommandHistoryEntry = {
      ...entry,
      id
    };

    const current = this.commandHistory.value;
    const updated = [historyEntry, ...current];

    // Keep only the most recent entries
    if (updated.length > this.MAX_HISTORY_ENTRIES) {
      updated.splice(this.MAX_HISTORY_ENTRIES);
    }

    this.commandHistory.next(updated);
    this.saveHistoryToStorage();
    
    this.logger.info(`Added command to history: ${entry.command} (ID: ${id})`);
    return id;
  }

  /**
   * Get a command from history by ID
   */
  getCommand(id: string): CommandHistoryEntry | null {
    return this.commandHistory.value.find(entry => entry.id === id) || null;
  }

  /**
   * Remove a command from history
   */
  removeCommand(id: string): boolean {
    const current = this.commandHistory.value;
    const updated = current.filter(entry => entry.id !== id);
    
    if (updated.length !== current.length) {
      this.commandHistory.next(updated);
      this.saveHistoryToStorage();
      this.logger.info(`Removed command from history: ${id}`);
      return true;
    }
    
    return false;
  }

  /**
   * Clear all command history
   */
  clearHistory(): void {
    this.commandHistory.next([]);
    this.saveHistoryToStorage();
    this.logger.info('Cleared all command history');
  }

  /**
   * Get filtered history by search term
   */
  searchHistory(searchTerm: string): CommandHistoryEntry[] {
    if (!searchTerm.trim()) {
      return this.commandHistory.value;
    }

    const term = searchTerm.toLowerCase();
    return this.commandHistory.value.filter(entry =>
      entry.command.toLowerCase().includes(term) ||
      entry.output.toLowerCase().includes(term) ||
      (entry.tabTitle && entry.tabTitle.toLowerCase().includes(term))
    );
  }

  /**
   * Get history filtered by success/failure
   */
  getFilteredHistory(filter: 'all' | 'success' | 'failed' | 'aborted'): CommandHistoryEntry[] {
    const history = this.commandHistory.value;
    console.log('[CommandHistoryManager] getFilteredHistory called with filter:', filter, 'total entries:', history.length);
    
    switch (filter) {
      case 'success':
        const successEntries = history.filter(entry => !entry.aborted && entry.exitCode === 0);
        console.log('[CommandHistoryManager] Success entries:', successEntries.length);
        return successEntries;
      case 'failed':
        const failedEntries = history.filter(entry => !entry.aborted && entry.exitCode !== 0);
        console.log('[CommandHistoryManager] Failed entries:', failedEntries.length);
        return failedEntries;
      case 'aborted':
        const abortedEntries = history.filter(entry => entry.aborted);
        console.log('[CommandHistoryManager] Aborted entries:', abortedEntries.length);
        return abortedEntries;
      default:
        console.log('[CommandHistoryManager] All entries:', history.length);
        return history;
    }
  }

  /**
   * Copy command to clipboard
   */
  async copyCommand(id: string): Promise<boolean> {
    const entry = this.getCommand(id);
    if (!entry) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(entry.command);
      this.logger.info(`Copied command to clipboard: ${entry.command}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to copy command to clipboard:', error);
      return false;
    }
  }

  /**
   * Copy command output to clipboard
   */
  async copyOutput(id: string): Promise<boolean> {
    const entry = this.getCommand(id);
    if (!entry) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(entry.output);
      this.logger.info(`Copied output to clipboard for command: ${entry.command}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to copy output to clipboard:', error);
      return false;
    }
  }

  /**
   * Export all command history as commands only
   */
  exportCommandsOnly(entries?: CommandHistoryEntry[]): string {
    const historyToExport = entries || this.commandHistory.value;
    
    if (historyToExport.length === 0) {
      return '';
    }

    const commands = historyToExport.map(entry => entry.command);
    const exportContent = commands.join('\n');
    
    this.logger.info(`Exported ${commands.length} commands only`);
    return exportContent;
  }

  /**
   * Export all command history with output
   */
  exportCommandsWithOutput(entries?: CommandHistoryEntry[]): string {
    const historyToExport = entries || this.commandHistory.value;
    
    if (historyToExport.length === 0) {
      return '';
    }

    const exportLines: string[] = [];
    
    historyToExport.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const status = entry.aborted ? 'ABORTED' : (entry.exitCode === 0 ? 'SUCCESS' : 'FAILED');
      const duration = entry.duration ? ` (${this.formatDuration(entry.duration)})` : '';
      
      exportLines.push(`# Entry ${index + 1} - ${timestamp} - ${status}${duration}`);
      if (entry.tabTitle) {
        exportLines.push(`# Terminal: ${entry.tabTitle}`);
      }
      exportLines.push(`$ ${entry.command}`);
      
      if (entry.output && entry.output.trim()) {
        exportLines.push(entry.output.trim());
      }
      
      if (entry.exitCode !== null) {
        exportLines.push(`# Exit Code: ${entry.exitCode}`);
      }
      
      exportLines.push(''); // Empty line between entries
    });
    
    const exportContent = exportLines.join('\n');
    this.logger.info(`Exported ${historyToExport.length} commands with output`);
    return exportContent;
  }

  /**
   * Export command history as JSON
   */
  exportAsJSON(entries?: CommandHistoryEntry[]): string {
    const historyToExport = entries || this.commandHistory.value;
    
    if (historyToExport.length === 0) {
      return '';
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalCommands: historyToExport.length,
      commands: historyToExport.map(entry => ({
        id: entry.id,
        command: entry.command,
        output: entry.output,
        exitCode: entry.exitCode,
        timestamp: entry.timestamp,
        date: new Date(entry.timestamp).toISOString(),
        aborted: entry.aborted,
        tabId: entry.tabId,
        tabTitle: entry.tabTitle,
        duration: entry.duration,
        status: entry.aborted ? 'ABORTED' : (entry.exitCode === 0 ? 'SUCCESS' : 'FAILED')
      }))
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    this.logger.info(`Exported ${historyToExport.length} commands as JSON`);
    return jsonContent;
  }

  /**
   * Export command history as CSV
   */
  exportAsCSV(entries?: CommandHistoryEntry[]): string {
    const historyToExport = entries || this.commandHistory.value;
    
    if (historyToExport.length === 0) {
      return '';
    }

    const csvLines: string[] = [];
    
    // CSV Header
    csvLines.push('Date,Command,Status,Exit Code,Duration (ms),Terminal,Output');
    
    // CSV Data
    historyToExport.forEach(entry => {
      const date = new Date(entry.timestamp).toISOString();
      const command = this.escapeCsvField(entry.command);
      const status = entry.aborted ? 'ABORTED' : (entry.exitCode === 0 ? 'SUCCESS' : 'FAILED');
      const exitCode = entry.exitCode !== null ? entry.exitCode.toString() : '';
      const duration = entry.duration ? entry.duration.toString() : '';
      const terminal = this.escapeCsvField(entry.tabTitle || '');
      const output = this.escapeCsvField(entry.output || '');
      
      csvLines.push(`${date},${command},${status},${exitCode},${duration},${terminal},${output}`);
    });

    const csvContent = csvLines.join('\n');
    this.logger.info(`Exported ${historyToExport.length} commands as CSV`);
    return csvContent;
  }

  /**
   * Export command history as Markdown
   */
  exportAsMarkdown(entries?: CommandHistoryEntry[]): string {
    const historyToExport = entries || this.commandHistory.value;
    
    if (historyToExport.length === 0) {
      return '';
    }

    const mdLines: string[] = [];
    
    // Markdown Header
    mdLines.push('# Command History Export');
    mdLines.push(`**Export Date:** ${new Date().toLocaleString()}`);
    mdLines.push(`**Total Commands:** ${historyToExport.length}`);
    mdLines.push('');
    mdLines.push('---');
    mdLines.push('');

    // Markdown entries
    historyToExport.forEach((entry, index) => {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const status = entry.aborted ? '⚠️ ABORTED' : (entry.exitCode === 0 ? '✅ SUCCESS' : '❌ FAILED');
      const duration = entry.duration ? ` (${this.formatDuration(entry.duration)})` : '';
      
      mdLines.push(`**Date:** ${timestamp}`);
      mdLines.push(`**Status:** ${status}${duration}`);
      if (entry.tabTitle) {
        mdLines.push(`**Terminal:** ${entry.tabTitle}`);
      }
      mdLines.push(`**Exit Code:** ${entry.exitCode !== null ? entry.exitCode : 'N/A'}`);
      mdLines.push('');
      mdLines.push('```bash');
      mdLines.push(entry.command);
      mdLines.push('```');
      mdLines.push('');
      
      if (entry.output && entry.output.trim()) {
        mdLines.push('```');
        mdLines.push(entry.output.trim());
        mdLines.push('```');
        mdLines.push('');
      }
      
      mdLines.push('---');
      mdLines.push('');
    });

    const mdContent = mdLines.join('\n');
    this.logger.info(`Exported ${historyToExport.length} commands as Markdown`);
    return mdContent;
  }

  /**
   * Escape CSV field (handle commas, quotes, newlines)
   */
  private escapeCsvField(field: string): string {
    if (!field) return '';
    
    // If field contains comma, quote, or newline, wrap in quotes and escape existing quotes
    if (field.indexOf(',') !== -1 || field.indexOf('"') !== -1 || field.indexOf('\n') !== -1 || field.indexOf('\r') !== -1) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    
    return field;
  }

  /**
   * Format duration for display
   */
  private formatDuration(duration: number): string {
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Generate unique entry ID
   */
  private generateEntryId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save history to localStorage
   */
  private saveHistoryToStorage(): void {
    try {
      const history = this.commandHistory.value;
      localStorage.setItem('mcp_command_history', JSON.stringify(history));
    } catch (error) {
      this.logger.error('Failed to save history to storage:', error);
    }
  }

  /**
   * Load history from localStorage
   */
  private loadHistoryFromStorage(): void {
    try {
      console.log('[CommandHistoryManager] Loading history from localStorage...');
      const stored = localStorage.getItem('mcp_command_history');
      console.log('[CommandHistoryManager] Stored data:', stored);
      
      if (stored) {
        const history: CommandHistoryEntry[] = JSON.parse(stored);
        console.log('[CommandHistoryManager] Parsed history:', history.length, 'entries');
        
        // Validate and filter valid entries
        const validHistory = history.filter(entry => 
          entry.id && entry.command && entry.timestamp
        );
        console.log('[CommandHistoryManager] Valid history:', validHistory.length, 'entries');
        
        this.commandHistory.next(validHistory);
        this.logger.info(`Loaded ${validHistory.length} entries from history storage`);
      } else {
        console.log('[CommandHistoryManager] No stored history found');
        this.commandHistory.next([]);
      }
    } catch (error) {
      console.error('[CommandHistoryManager] Error loading history:', error);
      this.logger.error('Failed to load history from storage:', error);
      this.commandHistory.next([]);
    }
  }

  /**
   * Download export content as file
   */
  async downloadExport(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8'): Promise<boolean> {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      this.logger.info(`Downloaded export file: ${filename}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to download export file:', error);
      return false;
    }
  }

  /**
   * Copy export content to clipboard
   */
  async copyExportToClipboard(content: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(content);
      this.logger.info('Copied export content to clipboard');
      return true;
    } catch (error) {
      this.logger.error('Failed to copy export content to clipboard:', error);
      return false;
    }
  }
} 