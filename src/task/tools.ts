import { type PluginInput, tool } from '@opencode-ai/plugin';
import Bun from 'bun';
import dedent from 'dedent';
import type { Tools } from '../types.ts';

const z = tool.schema;

export const TOOL_TASK_ID = 'elisha_task';

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

type TaskResult =
  | { success: true; result: string }
  | { success: false; error: string };

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

const getTaskResult = async (
  id: string,
  ctx: PluginInput,
): Promise<TaskResult> => {
  const { data: messages } = await ctx.client.session.messages({
    path: { id: id },
    query: { limit: 200 },
  });
  if (!messages) {
    return { success: false, error: 'No messages were found.' };
  }

  // Find the last assistant message
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((msg) => msg.info.role === 'assistant');
  if (!lastAssistantMessage) {
    return { success: false, error: 'No assistant response was found.' };
  }

  // Extract text content from the message parts
  const resultText = lastAssistantMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

  return {
    success: true,
    result: resultText || '(No text content in response)',
  };
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
        const activeAgents = await getActiveAgents(ctx);
        if (!activeAgents?.find((agent) => agent.name === args.agent)) {
          return `Agent('${args.agent}') not found or not active.`;
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
            return `Failed to create session for task: No session data returned.`;
          }
          session = data;
        } catch (error) {
          return `Failed to create session for task: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
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
            console.error(`Task(${session.id}) failed to start: ${error}`);
          });
          return `Task(${session.id}) started asynchronously.`;
        }

        const response = await promise;
        const result = response.data?.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n');

        return dedent`
          Task(${session.id}) completed.

          Agent: ${args.agent}
          Title: ${args.title}

          Result:
          ${result}
        `;
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
          return `Task(${args.task_id}) not found.`;
        }

        const completed = await isTaskComplete(task.id, ctx);
        if (completed) {
          // Session is complete, get the result
          const sessionResult = await getTaskResult(task.id, ctx);
          if (!sessionResult.success) {
            return `Task(${
              args.task_id
            }) completed with error: ${sessionResult.error.toLowerCase()}`;
          }

          return dedent`
            Task(${args.task_id}) completed.
            
            Title: ${task.title}
            
            Result:
            ${sessionResult.result}
          `;
        }

        if (args.wait) {
          // Wait for completion
          const waitResult = await waitForTask(task.id, args.timeout, ctx);
          if (!waitResult) {
            return `Reached timeout. Task(${args.task_id}) is still running.`;
          }

          // Task completed after waiting - fetch and return result
          const sessionResult = await getTaskResult(task.id, ctx);
          if (!sessionResult.success) {
            return `Task(${
              args.task_id
            }) completed with error: ${sessionResult.error.toLowerCase()}`;
          }

          return dedent`
            Task(${args.task_id}) completed.
            
            Title: ${task.title}
            
            Result:
            ${sessionResult.result}
          `;
        }

        return `Task(${args.task_id}) is still running.`;
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
          return `Task(${args.task_id}) not found.`;
        }

        const completed = await isTaskComplete(task.id, ctx);
        if (completed) {
          return `Task(${args.task_id}) already completed.`;
        }

        // Abort the session
        try {
          await ctx.client.session.abort({
            path: { id: task.id },
            query: { directory: ctx.directory },
          });
        } catch (error) {
          // Check if the error is because session completed between check and abort
          const nowCompleted = await isTaskComplete(task.id, ctx);
          if (nowCompleted) {
            return `Task(${args.task_id}) completed before cancellation.`;
          }
          return `Failed to cancel Task(${args.task_id}): ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
        }

        return `Task(${args.task_id}) cancelled.`;
      },
    }),
  };
};
