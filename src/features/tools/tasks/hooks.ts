import type { Session } from '@opencode-ai/sdk/v2';
import { PluginContext } from '~/context';
import { defineHookSet } from '~/hook';
import { log } from '~/utils';
import { Prompt } from '~/utils/prompt';
import {
  formatChildSessionList,
  getSessionAgentAndModel,
  getSiblingSessions,
  isSessionComplete,
} from '~/utils/session';
import {
  ASYNC_TASK_PREFIX,
  taskBroadcastTool,
  taskCancelTool,
  taskOutputTool,
  taskSendMessageTool,
} from '.';

const TASK_CONTEXT_PROMPT = Prompt.template`
## Active Tasks

The following task session IDs were created in this conversation. You can use these with the task tools:

- \`${taskOutputTool.id}\`: Get the result of a completed or running task
- \`${taskSendMessageTool.id}\`: Send a message to a running task
- \`${taskCancelTool.id}\`: Cancel a running task
`;

/**
 * Formats new sibling announcement for injection into existing tasks
 */
const formatNewSiblingAnnouncement = (taskId: string, agent: string, title: string): string => {
  return Prompt.template`
    <new_sibling task_id="${taskId}" agent="${agent}" title="${title}">
      A new sibling task has been created. You can communicate with it using \`${taskBroadcastTool.id}\` or \`${taskSendMessageTool.id}\`.
    </new_sibling>
  `;
};

export const taskHooks = defineHookSet({
  id: 'task-hooks',
  hooks: () => {
    const { client } = PluginContext.use();

    const injectedSessions = new Set<string>();

    return {
      event: async ({ event }) => {
        // Handle session created event for sibling injection
        if (event.type === 'session.created') {
          const session = event.properties.info as Session;
          if (!session.id || !session.parentID) return;

          // Get all sibling sessions
          const siblingsResult = await getSiblingSessions(session);
          if (siblingsResult.error) return;

          const siblings = siblingsResult.data.siblings;

          // Get new task's agent info
          const newTaskAgentResult = await getSessionAgentAndModel(session);
          const newTaskAgent = newTaskAgentResult.data?.agent || 'unknown';
          const newTaskTitle = session.title;

          // Announce new task to existing siblings
          const announcement = formatNewSiblingAnnouncement(session.id, newTaskAgent, newTaskTitle);
          for (const sibling of siblings) {
            const siblingAgentResult = await getSessionAgentAndModel(sibling);
            await client.session.promptAsync({
              sessionID: sibling.id,
              noReply: true,
              agent: siblingAgentResult.data?.agent,
              model: siblingAgentResult.data?.model,
              parts: [{ type: 'text', text: announcement, synthetic: true }],
              directory: sibling.directory,
            });
          }
        }

        // Notify parent session when task completes
        if (event.type === 'session.status' && event.properties.status.type === 'idle') {
          const sessionResult = await client.session.get({
            sessionID: event.properties.sessionID,
          });
          if (sessionResult.error) {
            log({
              level: 'error',
              message: `Failed to get session(${event.properties.sessionID}): ${sessionResult.error}`,
            });
            return;
          }

          const session = sessionResult.data;

          const completedResult = await isSessionComplete(session);
          if (completedResult.error) {
            log({
              level: 'error',
              message: `Failed to check if session(${session.id}) is complete: ${completedResult.error}`,
            });
            return;
          }

          if (completedResult.data) {
            if (!session.title.startsWith(ASYNC_TASK_PREFIX) || !session.parentID) return;

            const parentSessionResult = await client.session.get({
              sessionID: session.parentID,
              directory: session.directory,
            });
            if (parentSessionResult.error) {
              log({
                level: 'error',
                message: `Failed to get parent session(${session.parentID}): ${parentSessionResult.error}`,
              });
              return;
            }

            const parentSession = parentSessionResult.data;

            const parentAgentAndModelResult = await getSessionAgentAndModel(parentSession);
            if (parentAgentAndModelResult.error) {
              log({
                level: 'error',
                message: `Failed to get agent/model for parent session(${parentSession.id}): ${parentAgentAndModelResult.error}`,
              });
              return;
            }

            const { agent: parentAgent, model: parentModel } = parentAgentAndModelResult.data;

            // Notify parent that task completed (use elisha_task_output to get result)
            const notification = JSON.stringify({
              status: 'completed',
              task_id: session.id,
              title: session.title,
              work_dir: session.directory,
              message: `Task completed. Use \`${taskOutputTool.id}\` to get the result.`,
            });

            const promptResult = await client.session.promptAsync({
              sessionID: session.parentID,
              agent: parentAgent,
              model: parentModel,
              parts: [
                {
                  type: 'text',
                  text: notification,
                  synthetic: true,
                },
              ],
              directory: session.directory,
            });
            if (promptResult.error) {
              log({
                level: 'error',
                message: `Failed to notify parent session(${session.parentID}) of task(${session.id}) completion: ${promptResult.error}`,
              });
              return;
            }
          }
        }

        // Inject task context when session is compacted
        if (event.type === 'session.compacted') {
          const sessionResult = await client.session.get({
            sessionID: event.properties.sessionID,
          });
          if (sessionResult.error) {
            log({
              level: 'error',
              message: `Failed to get session(${event.properties.sessionID}): ${sessionResult.error}`,
            });
            return;
          }

          const session = sessionResult.data;

          // Get tasks for this session
          const taskListResult = await formatChildSessionList(session);
          if (taskListResult.error) {
            log({
              level: 'error',
              message: `Failed to get task list for session(${session.id}): ${taskListResult.error.message}`,
            });
            return;
          }
          const taskList = taskListResult.data;
          if (taskList) {
            // Get model/agent from recent messages
            const agentModelResult = await getSessionAgentAndModel(session);
            if (agentModelResult.error) {
              log({
                level: 'error',
                message: `Failed to get agent/model for session(${session.id}): ${agentModelResult.error}`,
              });
              return;
            }

            const { agent, model } = agentModelResult.data;

            injectedSessions.add(session.id);

            const promptResult = await client.session.promptAsync({
              sessionID: session.id,
              noReply: true,
              model,
              agent,
              parts: [
                {
                  type: 'text',
                  text: Prompt.template`
                      <task-context>
                        ${TASK_CONTEXT_PROMPT}

                        ${taskList}
                      </task-context>
                    `,
                  synthetic: true,
                },
              ],
              directory: session.directory,
            });
            if (promptResult.error) {
              log({
                level: 'error',
                message: `Failed to inject task context into session(${session.id}): ${promptResult.error}`,
              });
              return;
            }
          }
        }
      },
    };
  },
});
