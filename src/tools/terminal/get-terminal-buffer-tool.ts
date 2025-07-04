import * as z from 'zod';
import stripAnsi from 'strip-ansi';
import { createErrorResponse, StructuredResponseBuilder } from '../../type/types';
import { BaseTool } from './base-tool';
import { ExecToolCategory } from '../terminal';
import { McpLoggerService } from '../../services/mcpLogger.service';

/**
 * Tool for retrieving the current content (text buffer) of a terminal session
 *
 * This tool allows retrieving the text content of a terminal with options
 * to specify line ranges, useful for analyzing command output or terminal state.
 */
export class GetTerminalBufferTool extends BaseTool {
  private readonly MAX_LINES = 200;

  constructor(private execToolCategory: ExecToolCategory, logger: McpLoggerService) {
    super(logger);
  }

  getTool() {
    return {
      name: 'get_terminal_buffer',
      description: `Retrieves the current text content from a terminal session buffer with optional line range specification. Returns organized sections with buffer information and content.`,
      schema: {
        tabId: z.string().describe('The ID of the terminal tab to get the buffer from. Get available IDs by calling get_ssh_session_list first. Example: "0" or "1".'),

        startLine: z.number().int().min(1).optional().default(1)
          .describe('The starting line number from the bottom of the terminal buffer (1-based, default: 1). Line 1 is the most recent line at the bottom of the terminal. Example: 1 for the last line, 10 to start from the 10th line from the bottom.'),

        endLine: z.number().int().optional().default(-1)
          .describe('The ending line number from the bottom of the terminal buffer (1-based, default: -1 for all lines up to the maximum of 200). Must be greater than or equal to startLine. Example: 50 to get 50 lines, -1 to get all available lines up to the maximum.')
      },
      handler: async (params, extra) => {
        try {
          const { tabId, startLine, endLine } = params;

          // Find all terminal sessions
          const sessions = this.execToolCategory.findAndSerializeTerminalSessions();

          // Find the requested session
          const session = sessions.find(s => s.id.toString() === tabId);
          if (!session) {
            return createErrorResponse(`No terminal session found with ID ${tabId}`);
          }

          // Get terminal buffer
          const text = this.execToolCategory.getTerminalBufferText(session);
          if (!text) {
            return createErrorResponse('Failed to get terminal buffer text');
          }

          // Split into lines and remove empty lines
          const lines = stripAnsi(text).split('\n').filter(line => line.trim().length > 0);

          // Validate line ranges
          if (startLine < 1) {
            return createErrorResponse(`Invalid startLine: ${startLine}. Must be >= 1`);
          }

          if (endLine !== -1 && endLine < startLine) {
            return createErrorResponse(`Invalid endLine: ${endLine}. Must be >= startLine or -1`);
          }

          const totalLines = lines.length;

          // Calculate line indices from the bottom
          const start = Math.max(0, totalLines - startLine);
          const end = endLine === -1
            ? Math.max(start - this.MAX_LINES, 0)
            : Math.max(0, start - endLine);

          // Extract the requested lines
          const requestedLines = lines.slice(end, start);

          // Build structured response
          const actualEndLine = endLine === -1 ? Math.min(startLine + this.MAX_LINES - 1, totalLines) : endLine;

          const bufferInfo =
            `totalLines is ${totalLines}\n` +
            `startLine is ${startLine}\n` +
            `endLine is ${actualEndLine}\n` +
            `retrieved ${requestedLines.length} lines`;

          return new StructuredResponseBuilder()
            .addSection("Terminal Buffer Information", bufferInfo)
            .addSection("Terminal Buffer Content", requestedLines.join('\n'))
            .build();
        } catch (err) {
          this.logger.error(`Error getting terminal buffer:`, err);
          return createErrorResponse(`Failed to get terminal buffer: ${err.message || err}`);
        }
      }
    };
  }
}
