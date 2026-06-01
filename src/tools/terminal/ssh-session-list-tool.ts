import { createJsonResponse } from '../../type/types';
import { BaseTool } from './base-tool';
import { ExecToolCategory } from '../terminal';
import { McpLoggerService } from '../../services/mcpLogger.service';

/**
 * Tool for getting a list of all terminal sessions (SSH and local)
 *
 * This tool returns information about all available terminal sessions
 * that can be used with other terminal tools.
 */
export class SshSessionListTool extends BaseTool {
  constructor(private execToolCategory: ExecToolCategory, logger: McpLoggerService) {
    super(logger);
  }

  getTool() {
    return {
      name: 'get_ssh_session_list',
      description: `Returns a list of all available terminal sessions (SSH and local) with their IDs and status information.

USE CASES:
- Find available terminal sessions before executing commands
- Determine which terminal is currently focused
- Check terminal activity status

RETURNS:
An array of terminal session objects with the following structure:
[
  {
    "id": "0", // Unique ID to use with other terminal tools
    "title": "bash", // Terminal title
    "customTitle": "My Terminal", // User-defined title if set
    "hasActivity": false, // Whether there is activity in the terminal
    "hasFocus": true // Whether this terminal is currently focused
  },
  ...
]

RELATED TOOLS:
- exec_command: Execute commands in a terminal session
- get_terminal_buffer: Get the current content of a terminal

EXAMPLE USAGE:
1. Get available sessions: get_ssh_session_list()
2. Use the returned ID with exec_command: exec_command({ command: "ls", tabId: "0" })

NOTES:
- If no terminal sessions are available, an empty array will be returned
- Always check for available sessions before executing commands`,
      schema: {},
      handler: async (_, extra) => {
        const serializedSessions = this.execToolCategory.findAndSerializeTerminalSessions().map(session => ({
          id: session.id,
          title: session.tab.title,
          customTitle: session.tab.customTitle,
          hasActivity: session.tab.hasActivity,
          hasFocus: session.tab.hasFocus,
        }));

        return createJsonResponse(serializedSessions);
      }
    };
  }
}
