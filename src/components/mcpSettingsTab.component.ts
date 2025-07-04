import { Component, HostBinding, OnInit } from '@angular/core';
import { ConfigService } from 'tabby-core';
import { McpService } from '../services/mcpService';
import { McpLoggerService } from '../services/mcpLogger.service';

/** @hidden */
@Component({
    templateUrl: './mcpSettingsTab.component.pug',
})
export class McpSettingsTabComponent implements OnInit {
    @HostBinding('class.content-box') true
    isServerRunning = false;
    serverUrl: string = 'http://localhost:3001';
    port: number = 3001;
    enableDebugLogging: boolean = false;
    startOnBoot: boolean = true;

    // Pair Programming Mode settings
    pairProgrammingEnabled: boolean = false;
    autoFocusTerminal: boolean = true;
    showConfirmationDialog: boolean = true;
    showResultDialog: boolean = true;

    // Retype functionality settings
    requireRetype: boolean = false;
    retypeMode: string = 'partial';
    retypeThreshold: number = 10;

    // Bypass functionality settings
    allowRetypeBypass: boolean = true;
    bypassAfterAttempts: number = 2;
    bypassRequiresConfirmation: boolean = true;

    // Phase 2 enhancement settings
    enableCharacterHighlighting: boolean = true;
    caseInsensitiveMatching: boolean = false;
    showTypingMetrics: boolean = true;
    enableTypingSpeed: boolean = false;
    enableTabAutoCompletion: boolean = true;

    constructor(
        public config: ConfigService,
        private mcpService: McpService,
        private logger: McpLoggerService
    ) {
        console.log('McpSettingsTabComponent constructor');
    }

    ngOnInit(): void {
        console.log('McpSettingsTabComponent initialized');
        // Initialize config
        this.initializeConfig();

        // Load values from config
        this.loadConfigValues();

        // Check server status
        this.updateServerStatus();

        // Log initial state
        console.log('MCP Settings initial state:', {
            serverUrl: this.serverUrl,
            port: this.port,
            debugLogging: this.enableDebugLogging,
            startOnBoot: this.startOnBoot,
            configStore: this.config.store.mcp
        });
    }

    private initializeConfig(): void {
        console.log('Initializing MCP config');
        try {
            if (!this.config.store.mcp) {
                console.log('Creating default MCP config section');
                this.config.store.mcp = {
                    startOnBoot: true,
                    enabled: true,
                    port: 3001,
                    serverUrl: 'http://localhost:3001',
                    enableDebugLogging: false,
                    pairProgrammingMode: {
                        enabled: false,
                        autoFocusTerminal: true,
                        showConfirmationDialog: true,
                        showResultDialog: true,
                        requireRetype: false,
                        retypeMode: 'partial',
                        retypeThreshold: 10,
                        allowRetypeBypass: true,
                        bypassAfterAttempts: 2,
                        bypassRequiresConfirmation: true,
                        enableCharacterHighlighting: true,
                        caseInsensitiveMatching: false,
                        showTypingMetrics: true,
                        enableTypingSpeed: false,
                        enableTabAutoCompletion: true
                    }
                };
                this.config.save();
            } else if (!this.config.store.mcp.pairProgrammingMode) {
                // Initialize Pair Programming Mode settings if they don't exist
                this.config.store.mcp.pairProgrammingMode = {
                    enabled: false,
                    autoFocusTerminal: true,
                    showConfirmationDialog: true,
                    showResultDialog: true,
                    requireRetype: false,
                    retypeMode: 'partial',
                    retypeThreshold: 10,
                    allowRetypeBypass: true,
                    bypassAfterAttempts: 2,
                    bypassRequiresConfirmation: true,
                    enableCharacterHighlighting: true,
                    caseInsensitiveMatching: false,
                    showTypingMetrics: true,
                    enableTypingSpeed: false,
                    enableTabAutoCompletion: true
                };
                this.config.save();
            }
        } catch (error) {
            console.error('Error initializing MCP config:', error);
        }
    }

    private loadConfigValues(): void {
        console.log('Loading MCP config values');
        try {
            if (this.config.store.mcp) {
                this.serverUrl = this.config.store.mcp.serverUrl || 'http://localhost:3001';
                this.port = this.config.store.mcp.port || 3001;
                this.enableDebugLogging = !!this.config.store.mcp.enableDebugLogging;
                this.startOnBoot = this.config.store.mcp.startOnBoot !== false; // Default to true if not set

                // Load Pair Programming Mode settings
                if (this.config.store.mcp.pairProgrammingMode) {
                    this.pairProgrammingEnabled = !!this.config.store.mcp.pairProgrammingMode.enabled;
                    this.autoFocusTerminal = this.config.store.mcp.pairProgrammingMode.autoFocusTerminal !== false; // Default to true
                    this.showConfirmationDialog = this.config.store.mcp.pairProgrammingMode.showConfirmationDialog !== false; // Default to true
                    this.showResultDialog = this.config.store.mcp.pairProgrammingMode.showResultDialog !== false; // Default to true

                    // Load Retype functionality settings
                    this.requireRetype = !!this.config.store.mcp.pairProgrammingMode.requireRetype;
                    this.retypeMode = this.config.store.mcp.pairProgrammingMode.retypeMode || 'partial';
                    this.retypeThreshold = this.config.store.mcp.pairProgrammingMode.retypeThreshold || 10;

                    // Load Bypass functionality settings
                    this.allowRetypeBypass = this.config.store.mcp.pairProgrammingMode.allowRetypeBypass !== false; // Default to true
                    this.bypassAfterAttempts = this.config.store.mcp.pairProgrammingMode.bypassAfterAttempts || 2;
                    this.bypassRequiresConfirmation = this.config.store.mcp.pairProgrammingMode.bypassRequiresConfirmation !== false; // Default to true

                    // Load Phase 2 enhancement settings
                    this.enableCharacterHighlighting = this.config.store.mcp.pairProgrammingMode.enableCharacterHighlighting !== false; // Default to true
                    this.caseInsensitiveMatching = !!this.config.store.mcp.pairProgrammingMode.caseInsensitiveMatching; // Default to false
                    this.showTypingMetrics = this.config.store.mcp.pairProgrammingMode.showTypingMetrics !== false; // Default to true
                    this.enableTypingSpeed = !!this.config.store.mcp.pairProgrammingMode.enableTypingSpeed; // Default to false
                    this.enableTabAutoCompletion = this.config.store.mcp.pairProgrammingMode.enableTabAutoCompletion !== false; // Default to true
                }

                console.log('Loaded values:', {
                    serverUrl: this.serverUrl,
                    port: this.port,
                    enableDebugLogging: this.enableDebugLogging,
                    startOnBoot: this.startOnBoot,
                    pairProgrammingEnabled: this.pairProgrammingEnabled,
                    autoFocusTerminal: this.autoFocusTerminal,
                    showConfirmationDialog: this.showConfirmationDialog,
                    showResultDialog: this.showResultDialog,
                    requireRetype: this.requireRetype,
                    retypeMode: this.retypeMode,
                    retypeThreshold: this.retypeThreshold,
                    allowRetypeBypass: this.allowRetypeBypass,
                    bypassAfterAttempts: this.bypassAfterAttempts,
                    bypassRequiresConfirmation: this.bypassRequiresConfirmation,
                    enableCharacterHighlighting: this.enableCharacterHighlighting,
                    caseInsensitiveMatching: this.caseInsensitiveMatching,
                    showTypingMetrics: this.showTypingMetrics,
                    enableTypingSpeed: this.enableTypingSpeed,
                    enableTabAutoCompletion: this.enableTabAutoCompletion
                });
            } else {
                console.warn('MCP config section not found');
            }
        } catch (error) {
            console.error('Error loading MCP config values:', error);
        }
    }

    saveServerUrl(): void {
        console.log(`Saving server URL: ${this.serverUrl}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            this.config.store.mcp.serverUrl = this.serverUrl;
            this.config.save();
            this.logger.info(`Server URL updated to: ${this.serverUrl}`);
        } catch (error) {
            console.error('Error saving server URL:', error);
        }
    }

    savePort(): void {
        console.log(`Saving port: ${this.port}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            this.config.store.mcp.port = this.port;
            this.config.save();
            this.logger.info(`Port updated to: ${this.port}`);
        } catch (error) {
            console.error('Error saving port:', error);
        }
    }

    async startServer(): Promise<void> {
        console.log('Starting MCP server');
        try {
            await this.mcpService.startServer(this.port);
            this.updateServerStatus();
            this.logger.info('MCP server started successfully');
        } catch (error) {
            console.error('Error starting MCP server:', error);
            this.logger.error('Failed to start MCP server', error);
        }
    }

    async stopServer(): Promise<void> {
        console.log('Stopping MCP server');
        try {
            await this.mcpService.stopServer();
            this.updateServerStatus();
            this.logger.info('MCP server stopped successfully');
        } catch (error) {
            console.error('Error stopping MCP server:', error);
            this.logger.error('Failed to stop MCP server', error);
        }
    }

    private async updateServerStatus(): Promise<void> {
        try {
            this.isServerRunning = await this.mcpService.isServerRunning();
            console.log(`Server status updated: ${this.isServerRunning ? 'running' : 'stopped'}`);
        } catch (error) {
            console.error('Error checking server status:', error);
        }
    }

    toggleDebugLogging(): void {
        console.log(`Toggling debug logging to: ${this.enableDebugLogging}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            this.config.store.mcp.enableDebugLogging = this.enableDebugLogging;
            this.config.save();
            this.logger.setDebugEnabled(this.enableDebugLogging);
            this.logger.info(`Debug logging ${this.enableDebugLogging ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling debug logging:', error);
        }
    }

    toggleStartOnBoot(): void {
        console.log(`Toggling start on boot to: ${this.startOnBoot}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            this.config.store.mcp.startOnBoot = this.startOnBoot;
            this.config.save();
            this.logger.info(`Start on boot ${this.startOnBoot ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling start on boot:', error);
        }
    }

    togglePairProgrammingMode(): void {
        console.log(`Toggling Pair Programming Mode to: ${this.pairProgrammingEnabled}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.enabled = this.pairProgrammingEnabled;
            this.config.save();
            this.logger.info(`Pair Programming Mode ${this.pairProgrammingEnabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Pair Programming Mode:', error);
        }
    }

    toggleAutoFocusTerminal(): void {
        console.log(`Toggling Auto Focus Terminal to: ${this.autoFocusTerminal}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.autoFocusTerminal = this.autoFocusTerminal;
            this.config.save();
            this.logger.info(`Auto Focus Terminal ${this.autoFocusTerminal ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Auto Focus Terminal:', error);
        }
    }

    toggleShowConfirmationDialog(): void {
        console.log(`Toggling Show Confirmation Dialog to: ${this.showConfirmationDialog}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.showConfirmationDialog = this.showConfirmationDialog;
            this.config.save();
            this.logger.info(`Show Confirmation Dialog ${this.showConfirmationDialog ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Show Confirmation Dialog:', error);
        }
    }

    toggleShowResultDialog(): void {
        console.log(`Toggling Show Result Dialog to: ${this.showResultDialog}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.showResultDialog = this.showResultDialog;
            this.config.save();
            this.logger.info(`Show Result Dialog ${this.showResultDialog ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Show Result Dialog:', error);
        }
    }

    toggleRequireRetype(): void {
        console.log(`Toggling Require Retype to: ${this.requireRetype}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.requireRetype = this.requireRetype;
            this.config.save();
            this.logger.info(`Require Retype ${this.requireRetype ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Require Retype:', error);
        }
    }

    updateRetypeMode(): void {
        console.log(`Updating Retype Mode to: ${this.retypeMode}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.retypeMode = this.retypeMode;
            this.config.save();
            this.logger.info(`Retype Mode updated to: ${this.retypeMode}`);
        } catch (error) {
            console.error('Error updating Retype Mode:', error);
        }
    }

    updateRetypeThreshold(): void {
        console.log(`Updating Retype Threshold to: ${this.retypeThreshold}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.retypeThreshold = this.retypeThreshold;
            this.config.save();
            this.logger.info(`Retype Threshold updated to: ${this.retypeThreshold}`);
        } catch (error) {
            console.error('Error updating Retype Threshold:', error);
        }
    }

    toggleAllowRetypeBypass(): void {
        console.log(`Toggling Allow Retype Bypass to: ${this.allowRetypeBypass}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.allowRetypeBypass = this.allowRetypeBypass;
            this.config.save();
            this.logger.info(`Allow Retype Bypass ${this.allowRetypeBypass ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Allow Retype Bypass:', error);
        }
    }

    updateBypassAfterAttempts(): void {
        console.log(`Updating Bypass After Attempts to: ${this.bypassAfterAttempts}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.bypassAfterAttempts = this.bypassAfterAttempts;
            this.config.save();
            this.logger.info(`Bypass After Attempts updated to: ${this.bypassAfterAttempts}`);
        } catch (error) {
            console.error('Error updating Bypass After Attempts:', error);
        }
    }

    toggleBypassRequiresConfirmation(): void {
        console.log(`Toggling Bypass Requires Confirmation to: ${this.bypassRequiresConfirmation}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.bypassRequiresConfirmation = this.bypassRequiresConfirmation;
            this.config.save();
            this.logger.info(`Bypass Requires Confirmation ${this.bypassRequiresConfirmation ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Bypass Requires Confirmation:', error);
        }
    }

    toggleEnableCharacterHighlighting(): void {
        console.log(`Toggling Enable Character Highlighting to: ${this.enableCharacterHighlighting}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.enableCharacterHighlighting = this.enableCharacterHighlighting;
            this.config.save();
            this.logger.info(`Character Highlighting ${this.enableCharacterHighlighting ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Character Highlighting:', error);
        }
    }

    toggleCaseInsensitiveMatching(): void {
        console.log(`Toggling Case Insensitive Matching to: ${this.caseInsensitiveMatching}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.caseInsensitiveMatching = this.caseInsensitiveMatching;
            this.config.save();
            this.logger.info(`Case Insensitive Matching ${this.caseInsensitiveMatching ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Case Insensitive Matching:', error);
        }
    }

    toggleShowTypingMetrics(): void {
        console.log(`Toggling Show Typing Metrics to: ${this.showTypingMetrics}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.showTypingMetrics = this.showTypingMetrics;
            this.config.save();
            this.logger.info(`Typing Metrics ${this.showTypingMetrics ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Typing Metrics:', error);
        }
    }

    toggleEnableTypingSpeed(): void {
        console.log(`Toggling Enable Typing Speed to: ${this.enableTypingSpeed}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.enableTypingSpeed = this.enableTypingSpeed;
            this.config.save();
            this.logger.info(`Typing Speed ${this.enableTypingSpeed ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Typing Speed:', error);
        }
    }

    toggleEnableTabAutoCompletion(): void {
        console.log(`Toggling Enable Tab Auto-Completion to: ${this.enableTabAutoCompletion}`);
        try {
            if (!this.config.store.mcp) {
                this.config.store.mcp = {};
            }
            if (!this.config.store.mcp.pairProgrammingMode) {
                this.config.store.mcp.pairProgrammingMode = {};
            }
            this.config.store.mcp.pairProgrammingMode.enableTabAutoCompletion = this.enableTabAutoCompletion;
            this.config.save();
            this.logger.info(`Tab Auto-Completion ${this.enableTabAutoCompletion ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling Tab Auto-Completion:', error);
        }
    }
}
