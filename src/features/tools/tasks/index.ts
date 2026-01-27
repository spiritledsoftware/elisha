import type { Session } from '@opencode-ai/sdk/v2';
import * as z from 'zod';
import { getActiveAgents } from '~/agent/util';
import { PluginContext } from '~/context';
import { defineTool, defineToolSet } from '~/tool';
import { log } from '~/util';
import {
  fetchSessionOutput,
  formatMessageParts,
  getChildSessions,
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
          'Whether to run the task asynchronously in the background (fire-and-forget) (default=false).',
        ),
      timeout_ms: z
        .number()
        .optional()
        .describe(
          'Maximum time in **milliseconds** to wait for task completion (only if async=false). If timeout is reached, the task will be aborted.',
        ),
    },
    execute: async (args, toolCtx) => {
      const activeAgentsResult = await getActiveAgents();
      if (activeAgentsResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to retrieve active agents: ${JSON.stringify(
            activeAgentsResult.error,
          )}`,
          code: 'AGENT_NOT_FOUND',
        } satisfies TaskResult);
      }

      const agent = activeAgentsResult.data?.find((agent) =>
        agent.name.toLowerCase().includes(args.agent.toLowerCase()),
      );
      if (!agent) {
        return JSON.stringify({
          status: 'failed',
          error: `Agent(${args.agent}) not found or not active.`,
          code: 'AGENT_NOT_FOUND',
        } satisfies TaskResult);
      }

      const { client, directory } = PluginContext.use();

      let session: Session;
      const createSessionResult = await client.session.create({
        parentID: toolCtx.sessionID,
        title: args.async
          ? `${ASYNC_TASK_PREFIX} Task: ${args.title}`
          : `Task: ${args.title}`,
        directory,
      });
      if (createSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to create session for task: ${JSON.stringify(
            createSessionResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      session = createSessionResult.data;

      if (args.async) {
        const promptResult = await client.session.promptAsync({
          sessionID: session.id,
          agent: agent.name,
          parts: [{ type: 'text', text: args.prompt }],
          directory,
        });
        if (promptResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: session.id,
            error: `Failed to start async task: ${JSON.stringify(
              promptResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        return JSON.stringify({
          status: 'running',
          task_id: session.id,
          agent: agent.name,
          title: args.title,
        } satisfies TaskResult);
      }

      const promptPromise = client.session.prompt({
        sessionID: session.id,
        agent: agent.name,
        parts: [{ type: 'text', text: args.prompt }],
        directory,
      });

      // Handle timeout for synchronous execution
      if (args.timeout_ms !== undefined) {
        let didTimeout = false;
        const timeoutPromise = Bun.sleep(args.timeout_ms).then(() => {
          didTimeout = true;
        });

        await Promise.race([promptPromise, timeoutPromise]);

        if (didTimeout) {
          // Abort the session to clean up resources
          const abortResult = await client.session.abort({
            sessionID: session.id,
            directory,
          });
          if (abortResult.error) {
            await log({
              level: 'error',
              message: `Failed to abort timed-out task(${
                session.id
              }): ${JSON.stringify(abortResult.error)}`,
            });
          }

          return JSON.stringify({
            status: 'failed',
            task_id: session.id,
            error: `Task timed out after ${args.timeout_ms} ms`,
            code: 'TIMEOUT',
          } satisfies TaskResult);
        }
      }

      // No timeout or task completed before timeout
      const promptResult = await promptPromise;
      if (promptResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: session.id,
          error: `Failed to execute task: ${JSON.stringify(
            promptResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const injectResult = await client.session.promptAsync({
        sessionID: toolCtx.sessionID,
        agent: toolCtx.agent,
        parts: formatMessageParts(
          promptResult.data.parts,
          promptResult.data.info,
        ),
        directory,
      });
      if (injectResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: session.id,
          error: `Failed to inject task output into parent session: ${JSON.stringify(
            injectResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      return JSON.stringify({
        status: 'completed',
        task_id: session.id,
        agent: agent.name,
        title: args.title,
        result: 'See next message for session output',
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
      const childrenResult = await getChildSessions(toolCtx.sessionID);
      if (childrenResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to retrieve tasks: ${JSON.stringify(
            childrenResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      return JSON.stringify({
        tasks: childrenResult.data,
      });
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
        .default(60000)
        .describe(
          'Maximum time in **milliseconds** to wait for task completion (only if wait=true).',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client, directory } = PluginContext.use();

      const childrenResult = await getChildSessions(toolCtx.sessionID);
      if (childrenResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Failed to retrieve tasks: ${JSON.stringify(
            childrenResult.error,
          )}`,
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

      const agentAndModelResult = await getSessionAgentAndModel(task.id);
      if (agentAndModelResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          error: `Failed to get agent info: ${JSON.stringify(
            agentAndModelResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const completedResult = await isSessionComplete(task.id);
      if (completedResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          agent: agentAndModelResult.data.agent || 'unknown',
          title: task.title,
          error: `Failed to check task status: ${JSON.stringify(
            completedResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      let isCompleted = completedResult.data;
      if (!isCompleted && args.wait) {
        const waitResult = await waitForSession(task.id, args.timeout_ms);
        if (waitResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            agent: agentAndModelResult.data.agent || 'unknown',
            title: task.title,
            error: `Failed while waiting for task completion: ${JSON.stringify(
              waitResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        isCompleted = waitResult.data;
      }

      const sessionOutputResult = await fetchSessionOutput(task.id);
      if (sessionOutputResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          agent: agentAndModelResult.data.agent || 'unknown',
          title: task.title,
          error: `Failed to fetch task output: ${JSON.stringify(
            sessionOutputResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const injectResult = await client.session.promptAsync({
        sessionID: toolCtx.sessionID,
        agent: toolCtx.agent,
        parts: sessionOutputResult.data.parts,
        directory,
      });
      if (injectResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          agent: agentAndModelResult.data.agent || 'unknown',
          title: task.title,
          error: `Failed to inject task output into parent session: ${JSON.stringify(
            injectResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      if (isCompleted) {
        return JSON.stringify({
          status: 'completed',
          task_id: task.id,
          agent: agentAndModelResult.data.agent || 'unknown',
          title: task.title,
          result: 'See next message for session output',
        } satisfies TaskResult);
      }

      return JSON.stringify({
        status: 'running',
        task_id: task.id,
        agent: agentAndModelResult.data.agent || 'unknown',
        title: task.title,
        partialResult: 'See next message for current session output',
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
    execute: async (args, toolCtx) => {
      const { client, directory } = PluginContext.use();

      const childrenResult = await client.session.children({
        sessionID: toolCtx.sessionID,
        directory,
      });
      if (childrenResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Failed to retrieve tasks: ${JSON.stringify(
            childrenResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const task = childrenResult.data.find((s) => s.id === args.task_id);
      if (!task) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Task(${args.task_id}) not found.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const agentAndModelResult = await getSessionAgentAndModel(task.id);
      if (agentAndModelResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          error: `Failed to get agent info: ${JSON.stringify(
            agentAndModelResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const { agent, model } = agentAndModelResult.data;

      const { error } = await client.session.promptAsync({
        sessionID: task.id,
        agent,
        model,
        parts: [{ type: 'text', text: args.message }],
        directory,
      });
      if (error) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Failed to send message to task: ${JSON.stringify(error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

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

      const childrenResult = await getChildSessions(toolCtx.sessionID);
      if (childrenResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          error: `Failed to retrieve tasks: ${JSON.stringify(
            childrenResult.error,
          )}`,
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
          error: `Failed to check task status: ${JSON.stringify(
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
        sessionID: task.id,
        directory,
      });
      if (abortResult.error) {
        const nowCompletedResult = await isSessionComplete(task.id);
        if (nowCompletedResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            error: `Failed to check task status after abort failure: ${JSON.stringify(
              nowCompletedResult.error,
            )}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        if (nowCompletedResult.data) {
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
          error: `Failed to cancel task: ${JSON.stringify(abortResult.error)}`,
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
