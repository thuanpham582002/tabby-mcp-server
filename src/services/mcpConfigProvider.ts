import { Injectable } from '@angular/core';
import { ConfigProvider } from 'tabby-core';

/**
 * Provider for MCP module configuration defaults
 */
@Injectable()
export class McpConfigProvider extends ConfigProvider {
  /**
   * Default configuration values
   */
  defaults = {
    mcp: {
      startOnBoot: true,
      enabled: true,
      port: 3001,
      listenHost: '127.0.0.1',
      serverUrl: 'http://localhost:3001',
      enableDebugLogging: true,
      pairProgrammingMode: {
        enabled: false,
        autoFocusTerminal: true,
        showConfirmationDialog: true,
        showResultDialog: true
      }
    },
    hotkeys: {
      'mcp-abort-command': [
        'Ctrl-Shift-C',  // Sử dụng Ctrl-Shift-C để tránh conflict với Ctrl-C thông thường
      ],
    },
  };

  /**
   * Platform-specific defaults
   */
  platformDefaults = { };
}