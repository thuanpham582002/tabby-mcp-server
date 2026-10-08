import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import TabbyCoreModule, { AppService, ConfigProvider, ConfigService, ToolbarButtonProvider, HostWindowService, HotkeyProvider } from 'tabby-core';
import { McpService } from './services/mcpService';
import { McpLoggerService } from './services/mcpLogger.service';
import { ExecToolCategory } from './tools/terminal';
import { ExecCommandButtonComponent } from './components/execCommandButton.component';
import { MinimizedDialogsModalComponent } from './components/minimizedModal.component';
import { CommandHistoryModalComponent } from './components/commandHistoryModal.component';
import { McpToolbarButtonProvider } from './toolbarButtonProvider';
import { McpSettingsTabProvider } from './settings';
import { McpSettingsTabComponent } from './components/mcpSettingsTab.component';
import { SettingsTabProvider } from 'tabby-settings';
import { McpConfigProvider } from './services/mcpConfigProvider';
import { ConfirmCommandDialogModule } from './components/confirmCommandDialog.component';
import { CommandResultDialogModule } from './components/commandResultDialog.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { DialogService } from './services/dialog.service';
import { DialogManagerService } from './services/dialogManager.service';
import { MinimizedDialogManagerService } from './services/minimizedDialogManager.service';
import { CommandHistoryManagerService } from './services/commandHistoryManager.service';
import { RunningCommandsManagerService } from './services/runningCommandsManager.service';
import { RunningCommandsDialogComponent } from './components/runningCommandsDialog.component';
import { McpHotkeyService } from './services/mcpHotkey.service';
import { McpHotkeyProvider } from './services/mcpHotkeyProvider.service';

// Import global styles
import './styles.scss';

/**
 * Module for the MCP server integration
 */
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    TabbyCoreModule,
    NgbModule,
    CommandResultDialogModule,
    ConfirmCommandDialogModule
  ],
  // Xóa styleUrls ở đây
  providers: [
    McpService,
    McpLoggerService,
    ExecToolCategory,
    DialogService,
    DialogManagerService,
    MinimizedDialogManagerService,
    CommandHistoryManagerService,
    RunningCommandsManagerService,
    McpHotkeyService,
    { provide: ToolbarButtonProvider, useClass: McpToolbarButtonProvider, multi: true },
    { provide: SettingsTabProvider, useClass: McpSettingsTabProvider, multi: true },
    { provide: ConfigProvider, useClass: McpConfigProvider, multi: true },
    { provide: HotkeyProvider, useClass: McpHotkeyProvider, multi: true },
  ],
  declarations: [
    ExecCommandButtonComponent,
    MinimizedDialogsModalComponent,
    CommandHistoryModalComponent,
    RunningCommandsDialogComponent,
    McpSettingsTabComponent
  ],
  entryComponents: [
    ExecCommandButtonComponent,
    MinimizedDialogsModalComponent,
    CommandHistoryModalComponent,
    RunningCommandsDialogComponent,
    McpSettingsTabComponent
  ],
  exports: [
    ExecCommandButtonComponent
  ]
})
export default class McpModule {
  /**
   * Simple constructor for module initialization
   * Server initialization is handled by the toolbar button provider
   */
      private constructor(
        private app: AppService,
        private config: ConfigService,
        private mcpService: McpService,
        private logger: McpLoggerService,
        private hostWindow: HostWindowService,
        private mcpHotkeyService: McpHotkeyService
    ) {
    console.log('[McpModule] Module initialized');

        // Initialize the server properly after app and config are ready
        this.app.ready$.subscribe(() => {
            this.config.ready$.toPromise().then(() => {
                this.initServerOnBoot();
            });
        });
    }

    /**
     * Initialize server on boot based on configuration
     */
    private async initServerOnBoot(): Promise<void> {
        try {
            this.logger.info('Checking if MCP server should start on boot');

            // Ensure config is available (should be guaranteed by config.ready$)
            if (!this.config.store.mcp) {
                this.logger.warn('MCP config not found, using default settings');
                return;
            }

            // Check if startOnBoot is enabled
            const startOnBoot = this.config.store.mcp.startOnBoot !== false; // Default to true

            if (startOnBoot) {
                this.logger.info('Starting MCP server (start on boot enabled)');
                await this.mcpService.startServer(
                    this.config.store.mcp.port,
                    this.config.store.mcp.listenHost || '127.0.0.1'
                );
            } else {
                this.logger.info('MCP server not starting automatically (start on boot disabled)');
            }
        } catch (error) {
            this.logger.error('Error starting MCP server on boot:', error);
        }
    }
}

export * from './services/mcpService';
export * from './services/mcpLogger.service';
export * from './type/types';
export * from './services/mcpConfigProvider';
export * from './services/dialog.service';
export * from './services/dialogManager.service';
export * from './services/commandHistoryManager.service';
export * from './services/runningCommandsManager.service';
export * from './services/mcpHotkey.service';
export * from './services/mcpHotkeyProvider.service';
