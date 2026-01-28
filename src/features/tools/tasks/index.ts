import type { Session } from '@opencode-ai/sdk/v2';
import * as z from 'zod';
import { getActiveAgents } from '~/agent/utils';
import { PluginContext } from '~/context';
import { defineTool, defineToolSet } from '~/tool';
import { log } from '~/utils';
import { Prompt } from '~/utils/prompt';
import {
  fetchSessionOutput,
  formatBroadcastMessage,
  getActiveChildSessions,
  getChildSessionBroadcasts,
  getChildSessions,
  getRelatedSessions,
  getSessionAgentAndModel,
  getSiblingSessions,
  isSessionComplete,
  parseBroadcasts,
  waitForSession,
} from '~/utils/session';
import type { Broadcast, BroadcastResult, BroadcastsReadResult, TaskResult } from './types';

export const ASYNC_TASK_PREFIX = '[async]';
const TASK_TOOLSET_ID = 'elisha_task';

export const taskCreateTool = defineTool({
  id: `${TASK_TOOLSET_ID}_create`,
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
      work_dir: z
        .string()
        .optional()
        .describe(
          'Working directory for the task. If provided, task runs in this directory instead of current. Used for worktree isolation.',
        ),
    },
    execute: async (args, toolCtx) => {
      const activeAgentsResult = await getActiveAgents();
      if (activeAgentsResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to retrieve active agents: ${JSON.stringify(activeAgentsResult.error)}`,
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

      const { client } = PluginContext.use();
      const toolSessionResult = await client.session.get({
        sessionID: toolCtx.sessionID,
      });
      if (toolSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolCtx.sessionID,
          error: `Failed to retrieve tool context session: ${JSON.stringify(
            toolSessionResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const toolSession = toolSessionResult.data;
      const taskDirectory = args.work_dir ?? toolSession.directory;

      const createSessionResult = await client.session.create({
        parentID: toolCtx.sessionID,
        title: args.async ? `${ASYNC_TASK_PREFIX} Task: ${args.title}` : `Task: ${args.title}`,
        directory: taskDirectory,
      });
      if (createSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          error: `Failed to create session for task: ${JSON.stringify(createSessionResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }
      const taskSession = createSessionResult.data;

      // Get existing children to inject as sibling context for the new task
      const existingChildrenResult = await getActiveChildSessions(
        toolSession,
        taskSession.directory,
      );
      let siblingContext = '';
      if (!existingChildrenResult.error && existingChildrenResult.data.length > 0) {
        const siblingRows = await Promise.all(
          existingChildrenResult.data.map(async (child) => {
            const agentResult = await getSessionAgentAndModel(child);
            const agentName = agentResult.data?.agent || 'unknown';
            return `| ${child.id} | ${agentName} | ${child.title
              .replace(`${ASYNC_TASK_PREFIX} Task: `, '')
              .replace('Task: ', '')} | ${child.directory} |`;
          }),
        );

        siblingContext = Prompt.template`
          <sibling_tasks>
            You have sibling tasks working in parallel. You can communicate with them using:
            - \`${taskBroadcastTool.id}\`: Share discoveries with all siblings
            - \`${taskSendMessageTool.id}\`: Send direct message to a specific sibling

            | Task ID | Agent | Title | Directory |
            |---------|-------|-------|-----------|
            ${siblingRows.join('\n')}
          </sibling_tasks>
        `;
      }

      // Enrich prompt with sibling context
      let enrichedPrompt = Prompt.template(siblingContext + args.prompt);

      // Inject branch context if task is running in a different directory (worktree)
      if (taskSession.directory !== toolSession.directory) {
        const { $ } = PluginContext.use();
        const branchProc = await $`git rev-parse --abbrev-ref HEAD`
          .cwd(taskDirectory)
          .quiet()
          .nothrow();
        const branchName = branchProc.exitCode === 0 ? branchProc.text().trim() : 'unknown';

        const branchContext = Prompt.template`
          <branch_context>
            You are operating in a **worktree branch**: \`${branchName}\`

            **Working Directory**: ${taskSession.directory}
            **Parent Directory**: ${toolSession.directory}

            **Constraints**:
            - All work must stay within this branch's domain
            - Do NOT merge to parent branch - report completion instead
            - Do NOT modify files outside your assigned scope
          </branch_context>
        `;

        enrichedPrompt = Prompt.template(branchContext + enrichedPrompt);
      }

      if (args.async) {
        const promptResult = await client.session.promptAsync({
          sessionID: taskSession.id,
          agent: agent.name,
          parts: [{ type: 'text', text: enrichedPrompt }],
          directory: taskSession.directory,
        });
        if (promptResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: taskSession.id,
            title: taskSession.title,
            work_dir: taskSession.directory,
            error: `Failed to start async task: ${JSON.stringify(promptResult.error)}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        return JSON.stringify({
          status: 'running',
          task_id: taskSession.id,
          title: taskSession.title,
          agent: agent.name,
          work_dir: taskSession.directory,
        } satisfies TaskResult);
      }

      const promptPromise = client.session.prompt({
        sessionID: taskSession.id,
        agent: agent.name,
        parts: [{ type: 'text', text: enrichedPrompt }],
        directory: taskSession.directory,
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
            sessionID: taskSession.id,
            directory: taskSession.directory,
          });
          if (abortResult.error) {
            await log({
              level: 'error',
              message: `Failed to abort timed-out task(${
                taskSession.id
              }): ${JSON.stringify(abortResult.error)}`,
            });
          }

          return JSON.stringify({
            status: 'failed',
            task_id: taskSession.id,
            title: taskSession.title,
            work_dir: taskSession.directory,
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
          task_id: taskSession.id,
          title: taskSession.title,
          work_dir: taskSession.directory,
          error: `Failed to execute task: ${JSON.stringify(promptResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const sessionOutputResult = await fetchSessionOutput(taskSession);
      if (sessionOutputResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: taskSession.id,
          title: taskSession.title,
          agent: agent.name,
          work_dir: taskSession.directory,
          error: `Failed to fetch task output: ${JSON.stringify(sessionOutputResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const injectResult = await client.session.promptAsync({
        sessionID: toolCtx.sessionID,
        agent: toolCtx.agent,
        parts: sessionOutputResult.data.parts,
        directory: taskSession.directory,
      });
      if (injectResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: taskSession.id,
          title: taskSession.title,
          agent: agent.name,
          work_dir: taskSession.directory,
          error: `Failed to inject task output into parent session: ${JSON.stringify(
            injectResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      return JSON.stringify({
        status: 'completed',
        task_id: taskSession.id,
        title: taskSession.title,
        agent: agent.name,
        work_dir: taskSession.directory,
        result: 'See next message for session output',
      } satisfies TaskResult);
    },
  },
});

export const taskOutputTool = defineTool({
  id: `${TASK_TOOLSET_ID}_output`,
  config: {
    description: 'Get the output of a task.',
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
      work_dir: z
        .string()
        .optional()
        .describe(
          'Working directory of the task. Must be provided if the task was run in a different directory.',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client } = PluginContext.use();

      const toolSessionResult = await client.session.get({
        sessionID: toolCtx.sessionID,
      });
      if (toolSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolCtx.sessionID,
          error: `Failed to retrieve tool context session: ${JSON.stringify(
            toolSessionResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const toolSession = toolSessionResult.data;
      const taskDirectory = args.work_dir ?? toolSession.directory;

      const relatedResult = await getRelatedSessions(toolSession, taskDirectory);
      if (relatedResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolSession.id,
          title: toolSession.title,
          work_dir: taskDirectory,
          error: `Failed to retrieve tasks: ${JSON.stringify(relatedResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const task = relatedResult.data.find((s) => s.id === args.task_id);
      if (!task) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          work_dir: taskDirectory,
          error: `Invalid task ID - must be a child or sibling task.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const completedResult = await isSessionComplete(task);
      if (completedResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
          error: `Failed to check task status: ${JSON.stringify(completedResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      let isCompleted = completedResult.data;
      if (!isCompleted && args.wait) {
        const waitResult = await waitForSession(task, args.timeout_ms);
        if (waitResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            title: task.title,
            work_dir: task.directory,
            error: `Failed while waiting for task completion: ${JSON.stringify(waitResult.error)}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        isCompleted = waitResult.data;
      }

      const sessionOutputResult = await fetchSessionOutput(task);
      if (sessionOutputResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
          error: `Failed to fetch task output: ${JSON.stringify(sessionOutputResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const injectResult = await client.session.promptAsync({
        sessionID: toolSession.id,
        agent: toolCtx.agent,
        parts: sessionOutputResult.data.parts,
        directory: toolSession.directory,
      });
      if (injectResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
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
          title: task.title,
          work_dir: task.directory,
          result: 'See next message for session output',
        } satisfies TaskResult);
      }

      return JSON.stringify({
        status: 'running',
        task_id: task.id,
        title: task.title,
        work_dir: task.directory,
        partialResult: 'See next message for current session output',
      } satisfies TaskResult);
    },
  },
});

export const taskSendMessageTool = defineTool({
  id: `${TASK_TOOLSET_ID}_send_message`,
  config: {
    description: 'Send a message to a running or completed task.',
    args: {
      task_id: z.string().describe('The ID of the task to send the message to.'),
      message: z.string().describe('The message to send to the task.'),
      noReply: z
        .boolean()
        .default(false)
        .describe(
          'If true, inject message without triggering a response. Useful for passive notifications.',
        ),
      work_dir: z
        .string()
        .optional()
        .describe(
          'Working directory of the task. Must be provided if the task was run in a different directory.',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client } = PluginContext.use();

      const toolSessionResult = await client.session.get({
        sessionID: toolCtx.sessionID,
      });
      if (toolSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolCtx.sessionID,
          error: `Failed to retrieve tool context session: ${JSON.stringify(
            toolSessionResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const toolSession = toolSessionResult.data;
      const taskDirectory = args.work_dir ?? toolSession.directory;

      const relatedResult = await getRelatedSessions(toolSession, taskDirectory);
      if (relatedResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolSession.id,
          title: toolSession.title,
          work_dir: taskDirectory,
          error: `Failed to retrieve tasks: ${JSON.stringify(relatedResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const task = relatedResult.data.find((s) => s.id === args.task_id);
      if (!task) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          work_dir: taskDirectory,
          error: `Invalid task ID - must be a child or sibling task.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const agentAndModelResult = await getSessionAgentAndModel(task);
      if (agentAndModelResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
          error: `Failed to get agent info: ${JSON.stringify(agentAndModelResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const { agent, model } = agentAndModelResult.data;

      const { error } = await client.session.promptAsync({
        sessionID: task.id,
        agent,
        model,
        noReply: args.noReply,
        parts: [{ type: 'text', text: args.message }],
        directory: task.directory,
      });
      if (error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
          agent,
          error: `Failed to send message to task: ${JSON.stringify(error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      return JSON.stringify({
        status: 'completed',
        task_id: task.id,
        title: task.title,
        work_dir: task.directory,
        agent,
        result: 'Message sent successfully',
      });
    },
  },
});

export const taskCancelTool = defineTool({
  id: `${TASK_TOOLSET_ID}_cancel`,
  config: {
    description: 'Cancel a running task.',
    args: {
      task_id: z.string().describe('The ID of the task to cancel.'),
      work_dir: z
        .string()
        .optional()
        .describe(
          'Working directory of the task. Must be provided if the task was run in a different directory.',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client } = PluginContext.use();

      const toolSessionResult = await client.session.get({
        sessionID: toolCtx.sessionID,
      });
      if (toolSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolCtx.sessionID,
          error: `Failed to retrieve tool context session: ${JSON.stringify(
            toolSessionResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const toolSession = toolSessionResult.data;
      const taskDirectory = args.work_dir ?? toolSession.directory;

      const relativesResult = await getRelatedSessions(toolSession, taskDirectory);
      if (relativesResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolSession.id,
          title: toolSession.title,
          work_dir: taskDirectory,
          error: `Failed to retrieve tasks: ${JSON.stringify(relativesResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const task = relativesResult.data.find((s) => s.id === args.task_id);
      if (!task) {
        return JSON.stringify({
          status: 'failed',
          task_id: args.task_id,
          work_dir: taskDirectory,
          error: `Task not found.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const completedResult = await isSessionComplete(task);
      if (completedResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
          error: `Failed to check task status: ${JSON.stringify(completedResult.error)}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      if (completedResult.data) {
        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
          error: `Task already completed.`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const abortResult = await client.session.abort({
        sessionID: task.id,
        directory: task.directory,
      });
      if (abortResult.error) {
        const nowCompletedResult = await isSessionComplete(task);
        if (nowCompletedResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: task.id,
            title: task.title,
            work_dir: task.directory,
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
            title: task.title,
            work_dir: task.directory,
            error: `Task completed before cancellation.`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        return JSON.stringify({
          status: 'failed',
          task_id: task.id,
          title: task.title,
          work_dir: task.directory,
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

export const taskBroadcastTool = defineTool({
  id: `${TASK_TOOLSET_ID}_broadcast`,
  config: {
    description: 'Broadcast a message to sibling and/or child tasks.',
    args: {
      message: z
        .string()
        .max(2000)
        .describe('The information to share. Be concise and actionable. Max 2000 characters.'),
      category: z
        .enum(['discovery', 'warning', 'context', 'blocker'])
        .default('discovery')
        .describe(
          'Type of broadcast: discovery (found something), warning (avoid this), context (background info), blocker (need help)',
        ),
      target: z
        .enum(['all', 'children', 'siblings'])
        .default('all')
        .describe(
          'Who to broadcast to: siblings (peer tasks), children (delegated tasks), all (both)',
        ),
      work_dir: z
        .string()
        .optional()
        .describe(
          'Working directory of the tasks. Must be provided if the tasks were run in a different directory.',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client } = PluginContext.use();

      const toolSessionResult = await client.session.get({
        sessionID: toolCtx.sessionID,
      });
      if (toolSessionResult.error) {
        return JSON.stringify({
          status: 'failed',
          task_id: toolCtx.sessionID,
          error: `Failed to retrieve tool context session: ${JSON.stringify(
            toolSessionResult.error,
          )}`,
          code: 'SESSION_ERROR',
        } satisfies TaskResult);
      }

      const toolSession = toolSessionResult.data;
      const taskDirectory = args.work_dir ?? toolSession.directory;

      const recipients: Array<Session> = [];
      const errors: string[] = [];

      // Get siblings if target includes them
      if (args.target === 'siblings' || args.target === 'all') {
        const siblingsResult = await getSiblingSessions(toolSession, taskDirectory);
        if (siblingsResult.error) {
          const isNoParentError = siblingsResult.error.message === 'Session has no parent';
          const errorMessage = siblingsResult.error.message;

          if (args.target === 'siblings') {
            // Only targeting siblings and failed - return error
            return JSON.stringify({
              status: 'failed',
              target: args.target,
              error: isNoParentError
                ? 'Not a child task - cannot broadcast to siblings'
                : `Failed to get siblings: ${errorMessage}`,
            } satisfies BroadcastResult);
          }
          // Target is 'all' but no siblings - continue with children only
          errors.push(`Could not get siblings: ${errorMessage}`);
        } else {
          recipients.push(...siblingsResult.data.siblings);
        }
      }

      // Get children if target includes them
      if (args.target === 'children' || args.target === 'all') {
        const childrenResult = await getChildSessions(toolSession, taskDirectory);
        if (childrenResult.error) {
          errors.push(`Failed to get children: ${JSON.stringify(childrenResult.error)}`);
        } else {
          recipients.push(...childrenResult.data);
        }
      }

      // Dedupe recipients by ID
      const uniqueRecipients = Array.from(new Map(recipients.map((r) => [r.id, r])).values());

      // Format the broadcast message
      const broadcastXml = formatBroadcastMessage(
        toolCtx.agent,
        toolCtx.sessionID,
        args.category,
        args.message,
      );

      // Deliver to each recipient
      let delivered = 0;
      let skipped = 0;

      for (const recipient of uniqueRecipients) {
        // Skip self (shouldn't happen but be safe)
        if (recipient.id === toolCtx.sessionID) {
          skipped++;
          continue;
        }

        const agentAndModelResult = await getSessionAgentAndModel(recipient);
        if (agentAndModelResult.error) {
          return JSON.stringify({
            status: 'failed',
            task_id: recipient.id,
            title: recipient.title,
            work_dir: recipient.directory,
            error: `Failed to get agent info: ${JSON.stringify(agentAndModelResult.error)}`,
            code: 'SESSION_ERROR',
          } satisfies TaskResult);
        }

        const { agent, model } = agentAndModelResult.data;

        const result = await client.session.promptAsync({
          sessionID: recipient.id,
          noReply: true,
          agent,
          model,
          parts: [{ type: 'text', text: broadcastXml, synthetic: true }],
          directory: recipient.directory,
        });

        if (result.error) {
          errors.push(`Failed to deliver to ${recipient.id}: ${JSON.stringify(result.error)}`);
        } else {
          delivered++;
        }
      }

      // Determine status
      const status = errors.length === 0 ? 'success' : delivered > 0 ? 'partial' : 'failed';

      if (status === 'failed') {
        return JSON.stringify({
          status: 'failed',
          target: args.target,
          error: errors.join('; '),
        } satisfies BroadcastResult);
      }

      if (status === 'partial') {
        return JSON.stringify({
          status: 'partial',
          delivered_to: delivered,
          skipped,
          target: args.target,
          errors,
        } satisfies BroadcastResult);
      }

      return JSON.stringify({
        status: 'success',
        delivered_to: delivered,
        skipped,
        target: args.target,
      } satisfies BroadcastResult);
    },
  },
});

export const taskBroadcastsReadTool = defineTool({
  id: `${TASK_TOOLSET_ID}_broadcasts_read`,
  config: {
    description: 'Read broadcasts from sibling tasks or child tasks.',
    args: {
      category: z
        .enum(['discovery', 'warning', 'context', 'blocker', 'all'])
        .default('all')
        .describe('Filter broadcasts by category'),
      limit: z.number().default(10).describe('Maximum number of broadcasts to return'),
      source: z
        .enum(['self', 'children'])
        .default('self')
        .describe(
          'Where to read broadcasts from: self (current session), children (child task sessions)',
        ),
      work_dir: z
        .string()
        .optional()
        .describe(
          'Working directory of the tasks. Must be provided if the tasks were run in a different directory.',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client } = PluginContext.use();

      const toolSessionResult = await client.session.get({
        sessionID: toolCtx.sessionID,
      });
      if (toolSessionResult.error) {
        return JSON.stringify({
          broadcasts: [],
          total: 0,
          source: args.source,
        } satisfies BroadcastsReadResult);
      }
      const toolSession = toolSessionResult.data;
      const taskDirectory = args.work_dir ?? toolSession.directory;

      let broadcasts: Broadcast[] = [];

      if (args.source === 'self') {
        // Read broadcasts from current session
        const messagesResult = await client.session.messages({
          sessionID: toolSession.id,
          directory: taskDirectory,
        });

        if (messagesResult.error) {
          return JSON.stringify({
            broadcasts: [],
            total: 0,
            source: args.source,
          } satisfies BroadcastsReadResult);
        }

        broadcasts = parseBroadcasts(messagesResult.data);
        // Add source indicator
        broadcasts = broadcasts.map((b) => ({ ...b, source: 'self' as const }));
      } else {
        // Read broadcasts from child sessions
        const childBroadcastsResult = await getChildSessionBroadcasts(toolSession, taskDirectory);
        if (childBroadcastsResult.error) {
          return JSON.stringify({
            broadcasts: [],
            total: 0,
            source: args.source,
          } satisfies BroadcastsReadResult);
        }
        broadcasts = childBroadcastsResult.data;
      }

      // Filter by category if not 'all'
      if (args.category !== 'all') {
        broadcasts = broadcasts.filter((b) => b.category === args.category);
      }

      // Get total before applying limit
      const total = broadcasts.length;

      // Apply limit
      broadcasts = broadcasts.slice(0, args.limit);

      return JSON.stringify({
        broadcasts,
        total,
        source: args.source,
      } satisfies BroadcastsReadResult);
    },
  },
});

export const taskToolSet = defineToolSet({
  id: TASK_TOOLSET_ID,
  config: async () => ({
    [taskCreateTool.id]: await taskCreateTool.setup(),
    [taskOutputTool.id]: await taskOutputTool.setup(),
    [taskSendMessageTool.id]: await taskSendMessageTool.setup(),
    [taskCancelTool.id]: await taskCancelTool.setup(),
    [taskBroadcastTool.id]: await taskBroadcastTool.setup(),
    [taskBroadcastsReadTool.id]: await taskBroadcastsReadTool.setup(),
  }),
});
