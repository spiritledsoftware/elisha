import type { PluginInput } from '@opencode-ai/plugin';
import dedent from 'dedent';
import { getSessionModelAndAgent } from '~/agent/util/index.ts';
import { log } from '~/util/index.ts';
import type { Hooks } from '../types.ts';
import PROMPT from './prompt.md';
import { ASYNC_TASK_PREFIX } from './tool.ts';
import { getTaskList, isTaskComplete } from './util.ts';

export const setupTaskHooks = (ctx: PluginInput): Hooks => {
  const injectedSessions = new Set<string>();

  return {
    event: async ({ event }) => {
      // Notify parent session when task completes
      if (event.type === 'session.idle') {
        const sessionID = event.properties.sessionID;
        const completed = await isTaskComplete(sessionID, ctx);
        if (completed) {
          const { data: session } = await ctx.client.session.get({
            path: { id: sessionID },
            query: { directory: ctx.directory },
          });

          const title = session?.title;
          const parentID = session?.parentID;
          if (title?.startsWith(ASYNC_TASK_PREFIX) && parentID) {
            const { model, agent: parentAgent } = await getSessionModelAndAgent(
              parentID,
              ctx,
            );

            let taskAgent = 'unknown';
            try {
              const { agent } = await getSessionModelAndAgent(sessionID, ctx);
              taskAgent = agent || 'unknown';
            } catch (error) {
              log(
                {
                  level: 'error',
                  message: `Failed to get agent name for task(${sessionID}): ${
                    error instanceof Error ? error.message : 'Unknown error'
                  }`,
                },
                ctx,
              );
            }

            // Notify parent that task completed (use elisha_task_output to get result)
            const notification = JSON.stringify({
              status: 'completed',
              task_id: sessionID,
              agent: taskAgent,
              title: session?.title || 'Untitled task',
              message:
                'Task completed. Use elisha_task_output to get the result.',
            });

            try {
              await ctx.client.session.prompt({
                path: { id: parentID },
                body: {
                  agent: parentAgent,
                  model,
                  parts: [
                    {
                      type: 'text',
                      text: notification,
                      synthetic: true,
                    },
                  ],
                },
                query: { directory: ctx.directory },
              });
            } catch (error) {
              log(
                {
                  level: 'error',
                  message: `Failed to notify parent session(${parentID}) of task(${sessionID}) completion: ${
                    error instanceof Error ? error.message : 'Unknown error'
                  }`,
                },
                ctx,
              );
            }
          }
        }
      }

      // Inject task context when session is compacted
      if (event.type === 'session.compacted') {
        const sessionID = event.properties.sessionID;

        // Get tasks for this session
        const taskList = await getTaskList(sessionID, ctx);
        if (taskList) {
          // Get model/agent from recent messages
          const { model, agent } = await getSessionModelAndAgent(
            sessionID,
            ctx,
          );

          injectedSessions.add(sessionID);

          await ctx.client.session.prompt({
            path: { id: sessionID },
            body: {
              noReply: true,
              model,
              agent,
              parts: [
                {
                  type: 'text',
                  text: dedent`
                  <task-context>
                  ${PROMPT}

                  ${taskList}
                  </task-context>
                `,
                  synthetic: true,
                },
              ],
            },
          });
        }
      }
    },
  };
};
