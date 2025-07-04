import { StructuredResponseBuilder } from '../../type/types';
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
      description: `Lists all available terminal sessions with their IDs and status information. Returns organized sections showing session summary and detailed information for each terminal.`,
      schema: undefined,
      handler: async (_, extra) => {
        const serializedSessions = this.execToolCategory.findAndSerializeTerminalSessions().map(session => ({
          id: session.id,
          title: session.tab.title,
          customTitle: session.tab.customTitle,
          hasActivity: session.tab.hasActivity,
          hasFocus: session.tab.hasFocus,
        }));

        // Build structured response with session summary and details
        const totalSessions = serializedSessions.length;
        const activeSessions = serializedSessions.filter(s => s.hasActivity).length;
        const focusedSession = serializedSessions.find(s => s.hasFocus);

        const sessionSummary =
          `total sessions is ${totalSessions}\n` +
          `active sessions is ${activeSessions}\n` +
          `focused session is ${focusedSession ? `${focusedSession.id} (${focusedSession.title})` : 'none'}`;

        const sessionDetails = serializedSessions.map(session =>
          `id: ${session.id}\n` +
          `title: ${session.title}\n` +
          `customTitle: ${session.customTitle || 'none'}\n` +
          `hasActivity: ${session.hasActivity}\n` +
          `hasFocus: ${session.hasFocus}`
        ).join('\n');

        return new StructuredResponseBuilder()
          .addSection("Session Summary", sessionSummary)
          .addSectionIf(totalSessions > 0, "Session Details", sessionDetails)
          .addSectionIf(totalSessions === 0, "No Sessions", "No terminal sessions are currently available. Please open a terminal tab first.")
          .build();
      }
    };
  }
}
