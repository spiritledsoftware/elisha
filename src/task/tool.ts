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
} from '../util/session';
import type { TaskResult } from './types';

export const ASYNC_TASK_PREFIX = '[async]';
const TASK_TOOLSET_ID = 'elisha_task';

const taskTool = defineTool({
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
      const activeAgents = await getActiveAgents();
      if (!activeAgents?.find((agent) => agent.name === args.agent)) {
        return JSON.stringify({
          status: 'failed',
          error: `Agent(${args.agent}) not found or not active.`,
          code: 'AGENT_NOT_FOUND',
        } satisfies TaskResult);
      }

      const { client, directory } = PluginContext.use();

      let session: { id: string };
      try {
        const { data } = await client.session.create({
          body: {
            parentID: context.sessionID,
            title: args.async
              ? `${ASYNC_TASK_PREFIX} Task: ${args.title}`
              : `Task: ${args.title}`,
          },
          query: { directory },
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

      const promise = client.session.prompt({
        path: { id: session.id },
        body: {
          agent: args.agent,
          parts: [{ type: 'text', text: args.prompt }],
        },
        query: { directory },
      });

      if (args.async) {
        promise.catch(async (error) => {
          await log({
            level: 'error',
            message: `Task(${session.id}) failed to start: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          });
        });
        return JSON.stringify({
          status: 'running',
          task_id: session.id,
          title: args.title,
        } satisfies TaskResult);
      }

      try {
        await promise;
        const result = await fetchSessionText(session.id);
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
  },
});

const taskOutputTool = defineTool({
  id: `${TASK_TOOLSET_ID}_output`,
  config: {
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
      const { client, directory } = PluginContext.use();

      const sessions = await client.session.children({
        path: { id: toolCtx.sessionID },
        query: { directory },
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

      const completed = await isSessionComplete(task.id);
      if (completed) {
        try {
          const result = await fetchSessionText(task.id);
          const { agent = 'unknown' } = await getSessionAgentAndModel(task.id);
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
        const waitResult = await waitForSession(task.id, args.timeout);
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
          const result = await fetchSessionText(task.id);
          const { agent = 'unknown' } = await getSessionAgentAndModel(task.id);
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

      const sessions = await client.session.children({
        path: { id: toolCtx.sessionID },
        query: { directory },
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

      const completed = await isSessionComplete(task.id);
      if (completed) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          error: `Task already completed.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      try {
        await client.session.abort({
          path: { id: task.id },
          query: { directory },
        });
      } catch (error) {
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
  },
});

export const taskToolSet = defineToolSet({
  id: TASK_TOOLSET_ID,
  config: async () => ({
    [taskTool.id]: await taskTool.setup(),
    [taskOutputTool.id]: await taskOutputTool.setup(),
    [cancelTaskTool.id]: await cancelTaskTool.setup(),
  }),
});
