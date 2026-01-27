import { PluginContext } from '~/context';
import { defineHookSet } from '~/hook';
import { log } from '~/util';
import { Prompt } from '~/util/prompt';
import {
  formatChildSessionList,
  getSessionAgentAndModel,
  getSiblingSessions,
  isSessionComplete,
} from '~/util/session';
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
const formatNewSiblingAnnouncement = (
  taskId: string,
  agent: string,
  title: string,
): string => {
  return Prompt.template`
    <new_sibling task_id="${taskId}" agent="${agent}" title="${title}">
      A new sibling task has been created. You can communicate with it using \`${taskBroadcastTool.id}\` or \`${taskSendMessageTool.id}\`.
    </new_sibling>
  `;
};

export const taskHooks = defineHookSet({
  id: 'task-hooks',
  hooks: () => {
    const { client, directory } = PluginContext.use();

    const injectedSessions = new Set<string>();

    return {
      event: async ({ event }) => {
        // Handle session created event for sibling injection
        if (event.type === 'session.created') {
          const sessionInfo = event.properties.info;
          if (!sessionInfo.id || !sessionInfo.parentID) return;

          const sessionID = sessionInfo.id;

          // Get all sibling sessions
          const siblingsResult = await getSiblingSessions(sessionID);
          if (siblingsResult.error) return;

          const siblings = siblingsResult.data.siblings;

          // Get new task's agent info
          const newTaskAgentResult = await getSessionAgentAndModel(sessionID);
          const newTaskAgent = newTaskAgentResult.data?.agent || 'unknown';
          const newTaskTitle = sessionInfo.title;

          // Announce new task to existing siblings
          const announcement = formatNewSiblingAnnouncement(
            sessionID,
            newTaskAgent,
            newTaskTitle,
          );
          for (const sibling of siblings) {
            const siblingAgentResult = await getSessionAgentAndModel(
              sibling.id,
            );
            await client.session.promptAsync({
              sessionID: sibling.id,
              noReply: true,
              agent: siblingAgentResult.data?.agent,
              model: siblingAgentResult.data?.model,
              parts: [{ type: 'text', text: announcement, synthetic: true }],
              directory,
            });
          }
        }

        // Notify parent session when task completes
        if (
          event.type === 'session.status' &&
          event.properties.status.type === 'idle'
        ) {
          const sessionID = event.properties.sessionID;
          const completedResult = await isSessionComplete(sessionID);
          if (completedResult.error) {
            log({
              level: 'error',
              message: `Failed to check if session(${sessionID}) is complete: ${completedResult.error}`,
            });
            return;
          }

          if (completedResult.data) {
            const sessionResult = await client.session.get({
              sessionID,
              directory,
            });
            if (sessionResult.error) {
              log({
                level: 'error',
                message: `Failed to get session(${sessionID}): ${sessionResult.error}`,
              });
              return;
            }

            const { title, parentID } = sessionResult.data;
            if (!title.startsWith(ASYNC_TASK_PREFIX) || !parentID) return;
            const parentAgentAndModelResult =
              await getSessionAgentAndModel(parentID);
            if (parentAgentAndModelResult.error) {
              log({
                level: 'error',
                message: `Failed to get agent/model for parent session(${parentID}): ${parentAgentAndModelResult.error}`,
              });
              return;
            }

            const { agent: parentAgent, model: parentModel } =
              parentAgentAndModelResult.data;

            const taskAgentModelResult =
              await getSessionAgentAndModel(sessionID);
            if (taskAgentModelResult.error) {
              log({
                level: 'error',
                message: `Failed to get agent/model for task session(${sessionID}): ${taskAgentModelResult.error}`,
              });
              return;
            }

            const { agent: taskAgent } = taskAgentModelResult.data;

            // Notify parent that task completed (use elisha_task_output to get result)
            const notification = JSON.stringify({
              status: 'completed',
              task_id: sessionID,
              agent: taskAgent || 'unknown',
              title,
              message: `Task completed. Use \`${taskOutputTool.id}\` to get the result.`,
            });

            const promptResult = await client.session.promptAsync({
              sessionID: parentID,
              agent: parentAgent,
              model: parentModel,
              parts: [
                {
                  type: 'text',
                  text: notification,
                  synthetic: true,
                },
              ],
              directory,
            });
            if (promptResult.error) {
              log({
                level: 'error',
                message: `Failed to notify parent session(${parentID}) of task(${sessionID}) completion: ${promptResult.error}`,
              });
              return;
            }
          }
        }

        // Inject task context when session is compacted
        if (event.type === 'session.compacted') {
          const sessionID = event.properties.sessionID;

          // Get tasks for this session
          const taskList = await formatChildSessionList(sessionID);
          if (taskList) {
            // Get model/agent from recent messages
            const agentModelResult = await getSessionAgentAndModel(sessionID);
            if (agentModelResult.error) {
              log({
                level: 'error',
                message: `Failed to get agent/model for session(${sessionID}): ${agentModelResult.error}`,
              });
              return;
            }

            const { agent, model } = agentModelResult.data;

            injectedSessions.add(sessionID);

            const promptResult = await client.session.promptAsync({
              sessionID,
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
              directory,
            });
            if (promptResult.error) {
              log({
                level: 'error',
                message: `Failed to inject task context into session(${sessionID}): ${promptResult.error}`,
              });
              return;
            }
          }
        }
      },
    };
  },
});
