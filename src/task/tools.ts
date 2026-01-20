import { type PluginInput, tool } from '@opencode-ai/plugin';
import Bun from 'bun';
import type { Tools } from '../types.ts';

const z = tool.schema;

export const TOOL_TASK_ID = 'elisha_task';

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

const MAX_CONCURRENT_TASKS = 5;
const activeTasks = new Set<string>();

export type TaskResult =
  | {
      status: 'completed';
      taskId: string;
      agent: string;
      title: string;
      result: string;
    }
  | {
      status: 'failed';
      taskId?: string;
      error: string;
      code:
        | 'AGENT_NOT_FOUND'
        | 'SESSION_ERROR'
        | 'TIMEOUT'
        | 'CANCELLED'
        | 'CONCURRENCY_LIMIT';
    }
  | { status: 'running'; taskId: string; title: string }
  | { status: 'cancelled'; taskId: string };

export const getActiveAgents = async (ctx: PluginInput) => {
  return await ctx.client.app
    .agents({
      query: { directory: ctx.directory },
    })
    .then((res) => res.data || []);
};

const isTaskComplete = async (
  id: string,
  ctx: PluginInput,
): Promise<boolean> => {
  try {
    const [sessionStatus, sessionMessages] = await Promise.all([
      ctx.client.session
        .status({
          query: { directory: ctx.directory },
        })
        .then((r) => r.data?.[id]),
      ctx.client.session
        .messages({
          path: { id },
          query: { limit: 1 },
        })
        .then((r) => r.data),
    ]);

    // Session not found in status map - may have completed and been cleaned up
    if (!sessionStatus) {
      // Confirm by checking if session has messages
      const { data: messages } = await ctx.client.session.messages({
        path: { id },
        query: { limit: 1 },
      });
      // If session has messages and no status, likely completed
      return !!(messages && messages.length > 0);
    }

    // No messages yet, session is still busy
    if (!sessionMessages || sessionMessages.length === 0) {
      return false;
    }

    // Session is idle (completed)
    if (sessionStatus.type === 'idle') {
      return true;
    }

    return false;
  } catch {
    // On transient API errors, return false to continue polling
    return false;
  }
};

const MAX_POLL_INTERVAL_MS = 5000;
const BACKOFF_MULTIPLIER = 1.5;

const waitForTask = async (
  id: string,
  timeoutMs = TIMEOUT_MS,
  ctx: PluginInput,
): Promise<boolean> => {
  const effectiveTimeout = Math.max(timeoutMs, 1000);
  const startTime = Date.now();
  let pollInterval = POLL_INTERVAL_MS;
  while (Date.now() - startTime < effectiveTimeout) {
    const complete = await isTaskComplete(id, ctx);
    if (complete) {
      return true;
    }
    await Bun.sleep(pollInterval);
    pollInterval = Math.min(
      pollInterval * BACKOFF_MULTIPLIER,
      MAX_POLL_INTERVAL_MS,
    );
  }

  return false;
};

const fetchTaskText = async (id: string, ctx: PluginInput): Promise<string> => {
  const { data: messages } = await ctx.client.session.messages({
    path: { id: id },
    query: { limit: 200 },
  });
  if (!messages) {
    throw new Error('No messages were found.');
  }

  // Find the last assistant message
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((msg) => msg.info.role === 'assistant');
  if (!lastAssistantMessage) {
    throw new Error('No assistant response was found.');
  }

  // Extract text content from the message parts
  return (
    lastAssistantMessage.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n') || '(No text content in response)'
  );
};

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
        if (activeTasks.size >= MAX_CONCURRENT_TASKS) {
          return JSON.stringify({
            status: 'failed',
            error: `Maximum concurrent tasks reached (${MAX_CONCURRENT_TASKS}). Please wait for other tasks to complete.`,
            code: 'CONCURRENCY_LIMIT',
          } satisfies TaskResult);
        }

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
              title: `Task: ${args.title}`,
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

        activeTasks.add(session.id);

        if (args.async) {
          promise
            .catch((error) => {
              console.error(`Task(${session.id}) failed to start: ${error}`);
            })
            .finally(() => {
              activeTasks.delete(session.id);
            });
          return JSON.stringify({
            status: 'running',
            taskId: session.id,
            title: args.title,
          } satisfies TaskResult);
        }

        try {
          await promise;
          const result = await fetchTaskText(session.id, ctx);
          return JSON.stringify({
            status: 'completed',
            taskId: session.id,
            agent: args.agent,
            title: args.title,
            result,
          } satisfies TaskResult);
        } catch (error) {
          return JSON.stringify({
            status: 'failed',
            taskId: session.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        } finally {
          activeTasks.delete(session.id);
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
            taskId: args.task_id,
            error: `Task(${args.task_id}) not found.`,
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
              taskId: task.id,
              agent,
              title: task.title,
              result,
            } satisfies TaskResult);
          } catch (error) {
            return JSON.stringify({
              status: 'failed',
              taskId: task.id,
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
              taskId: task.id,
              error: 'Reached timeout waiting for task completion.',
              code: 'TIMEOUT',
            } satisfies TaskResult);
          }

          try {
            const result = await fetchTaskText(task.id, ctx);
            const agent = await getAgentName();
            return JSON.stringify({
              status: 'completed',
              taskId: task.id,
              agent,
              title: task.title,
              result,
            } satisfies TaskResult);
          } catch (error) {
            return JSON.stringify({
              status: 'failed',
              taskId: task.id,
              error: error instanceof Error ? error.message : 'Unknown error',
              code: 'SESSION_ERROR',
            } satisfies TaskResult);
          }
        }

        return JSON.stringify({
          status: 'running',
          taskId: task.id,
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
            taskId: args.task_id,
            error: `Task(${args.task_id}) not found.`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        const completed = await isTaskComplete(task.id, ctx);
        if (completed) {
          return JSON.stringify({
            status: 'failed',
            taskId: task.id,
            error: `Task(${args.task_id}) already completed.`,
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
              taskId: task.id,
              error: `Task(${args.task_id}) completed before cancellation.`,
              code: 'SESSION_ERROR',
            } satisfies TaskResult);
          }
          return JSON.stringify({
            status: 'failed',
            taskId: task.id,
            error: `Failed to cancel Task(${args.task_id}): ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        return JSON.stringify({
          status: 'cancelled',
          taskId: task.id,
        } satisfies TaskResult);
      },
    }),
  };
};
