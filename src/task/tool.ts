import { type PluginInput, tool } from '@opencode-ai/plugin';
import { getActiveAgents } from '~/agent/util/index.ts';
import { log } from '~/util/index.ts';
import type { Tools } from '../types.ts';
import type { TaskResult } from './types.ts';
import { fetchTaskText, isTaskComplete, waitForTask } from './util.ts';

const z = tool.schema;

export const TOOL_TASK_ID = 'elisha_task';

export const ASYNC_TASK_PREFIX = '[async]';

export const setupTaskTools = async (ctx: PluginInput): Promise<Tools> => {
  return {
    [TOOL_TASK_ID]: tool({
      description: 'Run a task using a specified agent.',
      args: {
        title: z.string().describe('Short description of the task to perform.'),
        agent: z
          .string()
          .describe('The name of the agent to use for the task.'),
        prompt: z.string().describe('The prompt to give to the agent.'),
        async: z
          .boolean()
          .default(false)
          .describe(
            'Whether to run the task asynchronously in the background. Default is false (synchronous).',
          ),
      },
      execute: async (args, context) => {
        const activeAgents = await getActiveAgents(ctx);
        if (!activeAgents?.find((agent) => agent.name === args.agent)) {
          return JSON.stringify({
            status: 'failed',
            error: `Agent(${args.agent}) not found or not active.`,
            code: 'AGENT_NOT_FOUND',
          } satisfies TaskResult);
        }

        let session: { id: string };
        try {
          const { data } = await ctx.client.session.create({
            body: {
              parentID: context.sessionID,
              title: args.async
                ? `${ASYNC_TASK_PREFIX} Task: ${args.title}`
                : `Task: ${args.title}`,
            },
            query: { directory: ctx.directory },
          });
          if (!data) {
            return JSON.stringify({
              status: 'failed',
              error: 'Failed to create session for task: No data returned.',
              code: 'SESSION_ERROR',
            } satisfies TaskResult);
          }
          session = data;
        } catch (error) {
          return JSON.stringify({
            status: 'failed',
            error: `Failed to create session for task: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        const promise = ctx.client.session.prompt({
          path: { id: session.id },
          body: {
            agent: args.agent,
            parts: [{ type: 'text', text: args.prompt }],
          },
          query: { directory: ctx.directory },
        });

        if (args.async) {
          promise.catch((error) => {
            log(
              {
                level: 'error',
                message: `Task(${session.id}) failed to start: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`,
              },
              ctx,
            );
          });
          return JSON.stringify({
            status: 'running',
            task_id: session.id,
            title: args.title,
          } satisfies TaskResult);
        }

        try {
          await promise;
          const result = await fetchTaskText(session.id, ctx);
          return JSON.stringify({
            status: 'completed',
            task_id: session.id,
            agent: args.agent,
            title: args.title,
            result,
          } satisfies TaskResult);
        } catch (error) {
          return JSON.stringify({
            status: 'failed',
            task_id: session.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }
      },
    }),
    [`${TOOL_TASK_ID}_output`]: tool({
      description: 'Get the output of a previously started task.',
      args: {
        task_id: z.string().describe('The ID of the task.'),
        wait: z
          .boolean()
          .default(false)
          .describe(
            'Whether to wait for the task to complete if it is still running.',
          ),
        timeout: z
          .number()
          .optional()
          .describe(
            'Maximum time in milliseconds to wait for task completion (only if wait=true).',
          ),
      },
      execute: async (args, toolCtx) => {
        const sessions = await ctx.client.session.children({
          path: { id: toolCtx.sessionID },
          query: { directory: ctx.directory },
        });

        const task = sessions.data?.find((s) => s.id === args.task_id);
        if (!task) {
          return JSON.stringify({
            status: 'failed',
            task_id: args.task_id,
            error: `Task not found.`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        // Try to find the agent from the session messages if not in child object
        const getAgentName = async () => {
          const { data } = await ctx.client.session.messages({
            path: { id: task.id },
            query: { limit: 10 }, // Check a few messages to find one with agent info
          });
          for (const msg of data || []) {
            if ('agent' in msg.info && msg.info.agent) {
              return msg.info.agent;
            }
          }
          return 'unknown';
        };

        const completed = await isTaskComplete(task.id, ctx);
        if (completed) {
          try {
            const result = await fetchTaskText(task.id, ctx);
            const agent = await getAgentName();
            return JSON.stringify({
              status: 'completed',
              task_id: task.id,
              agent,
              title: task.title,
              result,
            } satisfies TaskResult);
          } catch (error) {
            return JSON.stringify({
              status: 'failed',
              task_id: task.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              code: 'SESSION_ERROR',
            } satisfies TaskResult);
          }
        }

        if (args.wait) {
          const waitResult = await waitForTask(task.id, args.timeout, ctx);
          if (!waitResult) {
            return JSON.stringify({
              status: 'failed',
              task_id: task.id,
              error:
                'Reached timeout waiting for task completion. Try again later or add a longer timeout.',
              code: 'TIMEOUT',
            } satisfies TaskResult);
          }

          try {
            const result = await fetchTaskText(task.id, ctx);
            const agent = await getAgentName();
            return JSON.stringify({
              status: 'completed',
              task_id: task.id,
              agent,
              title: task.title,
              result,
            } satisfies TaskResult);
          } catch (error) {
            return JSON.stringify({
              status: 'failed',
              task_id: task.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              code: 'SESSION_ERROR',
            } satisfies TaskResult);
          }
        }

        return JSON.stringify({
          status: 'running',
          task_id: task.id,
          title: task.title,
        } satisfies TaskResult);
      },
    }),
    [`${TOOL_TASK_ID}_cancel`]: tool({
      description: 'Cancel a running task.',
      args: {
        task_id: z.string().describe('The ID of the task to cancel.'),
      },
      execute: async (args, toolCtx) => {
        const sessions = await ctx.client.session.children({
          path: { id: toolCtx.sessionID },
          query: { directory: ctx.directory },
        });

        const task = sessions.data?.find((s) => s.id === args.task_id);
        if (!task) {
          return JSON.stringify({
            status: 'failed',
            task_id: args.task_id,
            error: `Task not found.`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        const completed = await isTaskComplete(task.id, ctx);
        if (completed) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Task already completed.`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        try {
          await ctx.client.session.abort({
            path: { id: task.id },
            query: { directory: ctx.directory },
          });
        } catch (error) {
          const nowCompleted = await isTaskComplete(task.id, ctx);
          if (nowCompleted) {
            return JSON.stringify({
              status: 'failed',
              task_id: task.id,
              error: `Task completed before cancellation.`,
              code: 'SESSION_ERROR',
            } satisfies TaskResult);
          }
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Failed to cancel task: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        return JSON.stringify({
          status: 'cancelled',
          task_id: task.id,
        } satisfies TaskResult);
      },
    }),
  };
};
