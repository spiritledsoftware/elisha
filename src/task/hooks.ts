import type { PluginInput } from '@opencode-ai/plugin';
import dedent from 'dedent';
import type { Hooks } from '../types.ts';

import PROMPT from './prompt.md';

export const setupTaskHooks = (ctx: PluginInput): Hooks => {
  const injectedSessions = new Set<string>();

  const getTaskList = async (sessionId: string): Promise<string | null> => {
    // Get child sessions (tasks) for this session
    const { data: children } = await ctx.client.session.children({
      path: { id: sessionId },
    });

    if (!children || children.length === 0) {
      return null;
    }

    // Format task IDs as a list
    const taskList = children
      .map((child) => `- \`${child.id}\` - ${child.title || 'Untitled task'}`)
      .join('\n');

    return taskList;
  };

  return {
    event: async ({ event }) => {
      if (event.type === 'session.compacted') {
        const sessionId = event.properties.sessionID;

        // Get tasks for this session
        const taskList = await getTaskList(sessionId);
        if (!taskList) {
          return; // No tasks to inject
        }

        // Get model/agent from recent messages
        const { model, agent } = await ctx.client.session
          .messages({
            path: { id: sessionId },
            query: { limit: 50 },
          })
          .then(({ data }) => {
            for (const msg of data || []) {
              if ('model' in msg.info && msg.info.model) {
                return { model: msg.info.model, agent: msg.info.agent };
              }
            }
            return { model: undefined, agent: undefined };
          });

        injectedSessions.add(sessionId);

        await ctx.client.session.prompt({
          path: { id: sessionId },
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
    },
  };
};
