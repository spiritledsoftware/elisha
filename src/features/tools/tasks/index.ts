import type { Session } from '@opencode-ai/sdk';
import * as z from 'zod';
import { getActiveAgents } from '~/agent/util';
import { PluginContext } from '~/context';
import { defineTool, defineToolSet } from '~/tool';
import { log } from '~/util';
import {
  fetchSessionText,
  getSessionAgentAndModel,
  isSessionComplete,
  waitForSession,
} from '~/util/session';
import type { TaskResult } from './types';

export const ASYNC_TASK_PREFIX = '[async]';
const TASK_TOOLSET_ID = 'elisha_task';

export const taskTool = defineTool({
  id: TASK_TOOLSET_ID,
  config: {
    description: 'Run a task using a specified agent.',
    args: {
      title: z.string().describe('Short description of the task to perform.'),
      agent: z.string().describe('The name of the agent to use for the task.'),
      prompt: z.string().describe('The prompt to give to the agent.'),
      async: z
        .boolean()
        .default(false)
        .describe(
          'Whether to run the task asynchronously in the background. Default is false (synchronous).',
        ),
    },
    execute: async (args, context) => {
      const activeAgentsResult = await getActiveAgents();
      if (activeAgentsResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to retrieve active agents: ${String(
            activeAgentsResult.error,
          )}`,
          code: 'AGENT_NOT_FOUND',
        } satisfies TaskResult);
      }

      if (
        !activeAgentsResult.data?.find((agent) => agent.name === args.agent)
      ) {
        return JSON.stringify({
          status: 'failed',
          error: `Agent(${args.agent}) not found or not active.`,
          code: 'AGENT_NOT_FOUND',
        } satisfies TaskResult);
      }

      const { client, directory } = PluginContext.use();

      let session: Session;
      const createSessionResult = await client.session.create({
        body: {
          parentID: context.sessionID,
          title: args.async
            ? `${ASYNC_TASK_PREFIX} Task: ${args.title}`
            : `Task: ${args.title}`,
        },
        query: { directory },
      });
      if (createSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to create session for task: ${String(
            createSessionResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      session = createSessionResult.data;

      const promptPromise = client.session.prompt({
        path: { id: session.id },
        body: {
          agent: args.agent,
          parts: [{ type: 'text', text: args.prompt }],
        },
        query: { directory },
      });

      if (args.async) {
        promptPromise.then(async ({ error }) => {
          if (error) {
            await log({
              level: 'error',
              message: `Task(${session.id}) failed to start: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            });
          }
        });
        return JSON.stringify({
          status: 'running',
          task_id: session.id,
          title: args.title,
        } satisfies TaskResult);
      }

      const promptResult = await promptPromise;
      if (promptResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: session.id,
          error: `Failed to execute task: ${String(promptResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const result =
        promptResult.data.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('\n') || '(No text content in response)';

      return JSON.stringify({
        status: 'completed',
        task_id: session.id,
        agent: args.agent,
        title: args.title,
        result,
      } satisfies TaskResult);
    },
  },
});

export const listTasksTool = defineTool({
  id: `${TASK_TOOLSET_ID}_list`,
  config: {
    description: 'List all tasks started in the current session.',
    args: {},
    execute: async (_, toolCtx) => {
      const { client, directory } = PluginContext.use();

      const childrenResult = await client.session.children({
        path: { id: toolCtx.sessionID },
        query: { directory },
      });
      if (childrenResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to retrieve tasks: ${String(childrenResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const tasks = childrenResult.data.map((s) => ({
        task_id: s.id,
        title: s.title,
      }));
      return JSON.stringify(tasks);
    },
  },
});

export const taskOutputTool = defineTool({
  id: `${TASK_TOOLSET_ID}_output`,
  config: {
    description: 'Get the output of a previously started task.',
    args: {
      task_id: z.string().describe('The ID of the task.'),
      wait: z
        .boolean()
        .default(false)
        .describe(
          'Whether to wait for the task to complete if it is still running (default=false).',
        ),
      timeout_ms: z
        .number()
        .optional()
        .describe(
          'Maximum time in **milliseconds** to wait for task completion (only if wait=true).',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client, directory } = PluginContext.use();

      const childrenResult = await client.session.children({
        path: { id: toolCtx.sessionID },
        query: { directory },
      });
      if (childrenResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Failed to retrieve tasks: ${String(childrenResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const task = childrenResult.data.find((s) => s.id === args.task_id);
      if (!task) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Task not found.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const isSessionCompletedResult = await isSessionComplete(task.id);
      if (isSessionCompletedResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          error: `Failed to check task status: ${String(
            isSessionCompletedResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      if (isSessionCompletedResult.data) {
        const sessionTextResult = await fetchSessionText(task.id);
        if (sessionTextResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Failed to fetch task output: ${String(
              sessionTextResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        const agentAndModelResult = await getSessionAgentAndModel(task.id);
        if (agentAndModelResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Failed to get agent info: ${String(
              agentAndModelResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        return JSON.stringify({
          status: 'completed',
          task_id: task.id,
          agent: agentAndModelResult.data.agent || 'unknown',
          title: task.title,
          result: sessionTextResult.data,
        } satisfies TaskResult);
      }

      if (args.wait) {
        const waitResult = await waitForSession(task.id, args.timeout_ms);
        if (waitResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Failed while waiting for task completion: ${String(
              waitResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        if (!waitResult.data) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error:
              'Reached timeout waiting for task completion. Try again later or add a longer timeout.',
            code: 'WAIT_TIMEOUT',
          } satisfies TaskResult);
        }

        const sessionTextResult = await fetchSessionText(task.id);
        if (sessionTextResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Failed to fetch task output: ${String(
              sessionTextResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        const agentAndModelResult = await getSessionAgentAndModel(task.id);
        if (agentAndModelResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Failed to get agent info: ${String(
              agentAndModelResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        return JSON.stringify({
          status: 'completed',
          task_id: task.id,
          agent: agentAndModelResult.data.agent || 'unknown',
          title: task.title,
          result: sessionTextResult.data,
        } satisfies TaskResult);
      }

      return JSON.stringify({
        status: 'running',
        task_id: task.id,
        title: task.title,
      } satisfies TaskResult);
    },
  },
});

export const sendMessageToTaskTool = defineTool({
  id: `${TASK_TOOLSET_ID}_send_message`,
  config: {
    description: 'Send a message to a running task.',
    args: {
      task_id: z
        .string()
        .describe('The ID of the task to send the message to.'),
      message: z.string().describe('The message to send to the task.'),
    },
    execute: async (args) => {
      const { client, directory } = PluginContext.use();

      client.session
        .prompt({
          path: { id: args.task_id },
          body: {
            agent: 'user',
            parts: [{ type: 'text', text: args.message, synthetic: true }],
          },
          query: { directory },
        })
        .then(async ({ error }) => {
          if (error) {
            await log({
              level: 'error',
              message: `Failed to send message to task(${
                args.task_id
              }): ${String(error.data)}`,
            });
          }
        });

      return JSON.stringify({
        task_id: args.task_id,
        result: 'Message sent.',
      });
    },
  },
});

export const cancelTaskTool = defineTool({
  id: `${TASK_TOOLSET_ID}_cancel`,
  config: {
    description: 'Cancel a running task.',
    args: {
      task_id: z.string().describe('The ID of the task to cancel.'),
    },
    execute: async (args, toolCtx) => {
      const { client, directory } = PluginContext.use();

      const childrenResult = await client.session.children({
        path: { id: toolCtx.sessionID },
        query: { directory },
      });
      if (childrenResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Failed to retrieve tasks: ${String(childrenResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const task = childrenResult.data.find((s) => s.id === args.task_id);
      if (!task) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Task not found.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const completedResult = await isSessionComplete(task.id);
      if (completedResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          error: `Failed to check task status: ${String(
            completedResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      if (completedResult.data) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          error: `Task already completed.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const abortResult = await client.session.abort({
        path: { id: task.id },
        query: { directory },
      });
      if (abortResult.error) {
        const nowCompleted = await isSessionComplete(task.id);
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
          error: `Failed to cancel task: ${String(abortResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      return JSON.stringify({
        status: 'cancelled',
        task_id: task.id,
      } satisfies TaskResult);
    },
  },
});

export const taskToolSet = defineToolSet({
  id: TASK_TOOLSET_ID,
  config: async () => ({
    [taskTool.id]: await taskTool.setup(),
    [listTasksTool.id]: await listTasksTool.setup(),
    [taskOutputTool.id]: await taskOutputTool.setup(),
    [sendMessageToTaskTool.id]: await sendMessageToTaskTool.setup(),
    [cancelTaskTool.id]: await cancelTaskTool.setup(),
  }),
});
