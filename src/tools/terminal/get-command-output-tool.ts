import * as z from 'zod';
import { createErrorResponse, StructuredResponseBuilder } from '../../type/types';
import { BaseTool } from './base-tool';
import { McpLoggerService } from '../../services/mcpLogger.service';
import { CommandOutputStorageService } from '../../services/commandOutputStorage.service';

/**
 * Tool for retrieving the full or paginated output of previously executed commands
 *
 * This tool allows accessing the complete output of commands that may have been
 * truncated in the initial response due to length limitations, with pagination
 * support for very long outputs.
 */
export class GetCommandOutputTool extends BaseTool {
  private readonly MAX_LINES_PER_RESPONSE = 250;
  private outputStorage: CommandOutputStorageService;

  constructor(logger: McpLoggerService, outputStorage?: CommandOutputStorageService) {
    super(logger);
    // If outputStorage is not provided, create a new instance
    this.outputStorage = outputStorage || new CommandOutputStorageService(logger);
  }

  getTool() {
    return {
      name: 'get_command_output',
      description: `Retrieves stored command output using an outputId from previous executions. Returns organized sections with command information, output content, and pagination details when applicable.`,
      schema: {
        outputId: z.string().describe('The unique ID of the stored command output to retrieve. This ID is returned by the exec_command tool when a command has been executed. Example: "cmd_1234567890".'),

        startLine: z.number().int().min(1).optional().default(1)
          .describe('The line number to start retrieving output from (1-based, default: 1). Use this for pagination to retrieve different portions of long outputs. Example: 1 for the first page, 251 for the second page when using default maxLines.'),

        maxLines: z.number().int().optional().default(250)
          .describe('The maximum number of lines to return in a single response (default: 250, maximum: 1000). Adjust this value to control the amount of data returned. Example: 100 for smaller chunks, 500 for larger chunks.')
      },
      handler: async (params: any) => {
        try {
          const { outputId, startLine, maxLines } = params;

          // Get the paginated output
          const paginatedOutput = this.outputStorage.getPaginatedOutput(
            outputId,
            startLine,
            maxLines || this.MAX_LINES_PER_RESPONSE
          );

          if (!paginatedOutput) {
            return createErrorResponse(`Command output with ID ${outputId} not found`);
          }

          // Format the output
          const { lines, totalLines, part, totalParts, command, exitCode, promptShell, aborted } = paginatedOutput;

          // Build structured response using the builder pattern
          const builder = new StructuredResponseBuilder()
            .addSection("Command Information",
              `command is ${command}\n` +
              `exitCode is ${exitCode ?? 'unknown'}\n` +
              `aborted is ${aborted}\n` +
              `directory where command executed is ${promptShell || 'unknown'}`
            )
            .addSection("Command Output", lines.join('\n'));

          // Add pagination information if there are multiple parts
          if (totalParts > 1) {
            const paginationInfo =
              `showing part ${part} of ${totalParts}\n` +
              `lines ${startLine} to ${Math.min(startLine + lines.length - 1, totalLines)} of ${totalLines} total lines\n` +
              `maxLines per page is ${maxLines}\n` +
              `to see next part use startLine ${startLine + maxLines}`;

            builder.addSection("Pagination Information", paginationInfo);
          }

          return builder.build();
        } catch (err) {
          this.logger.error(`Error retrieving command output:`, err);
          return createErrorResponse(`Failed to retrieve command output: ${err.message || err}`);
        }
      }
    };
  }
}
