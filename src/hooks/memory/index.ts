import type { PluginInput } from '@opencode-ai/plugin';
import dedent from 'dedent';
import type { Hooks } from '..';

import MEMORY_GUIDANCE from './prompt.md';

export const setupMemoryHooks = (ctx: PluginInput): Hooks => {
  const injectedSessions = new Set<string>();

  return {
    'chat.message': async (_input, output) => {
      const { data: config } = await ctx.client.config.get();
      if (!(config?.mcp?.openmemory?.enabled ?? true)) {
        return;
      }

      const sessionId = output.message.sessionID;
      if (injectedSessions.has(sessionId)) return;

      const existing = await ctx.client.session.messages({
        path: { id: sessionId },
      });
      if (!existing.data) return;

      const hasMemoryCtx = existing.data.some((msg) => {
        if (msg.parts.length === 0) return false;
        return msg.parts.some(
          (part) =>
            part.type === 'text' && part.text.includes('<memory-context>'),
        );
      });
      if (hasMemoryCtx) {
        injectedSessions.add(sessionId);
        return;
      }

      injectedSessions.add(sessionId);
      await ctx.client.session.prompt({
        path: { id: sessionId },
        body: {
          noReply: true,
          model: output.message.model,
          agent: output.message.agent,
          parts: [
            {
              type: 'text',
              text: dedent`
              <memory-context>
                ${MEMORY_GUIDANCE}
              </memory-context>`,
              synthetic: true,
            },
          ],
        },
      });
    },
    event: async ({ event }) => {
      if (event.type === 'session.compacted') {
        const sessionId = event.properties.sessionID;

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
            return {};
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
                <memory-context>
                  ${MEMORY_GUIDANCE}
                </memory-context>`,
                synthetic: true,
              },
            ],
          },
        });
      }
    },
  };
};
