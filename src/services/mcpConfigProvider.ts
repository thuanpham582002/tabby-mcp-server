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
      serverUrl: 'http://localhost:3001',
      enableDebugLogging: true,
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