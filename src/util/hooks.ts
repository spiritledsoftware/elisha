import type { Hooks } from '@opencode-ai/plugin';

/**
 * Aggregates multiple hook sets into a single Hooks object.
 * Same-named hooks are merged with Promise.all for concurrent execution.
 */
export const aggregateHooks = (...hookSets: Hooks[]): Hooks => {
  return {
    'chat.params': async (input, output) => {
      await Promise.all(hookSets.map((h) => h['chat.params']?.(input, output)));
    },
    'chat.message': async (input, output) => {
      await Promise.all(
        hookSets.map((h) => h['chat.message']?.(input, output)),
      );
    },
    'command.execute.before': async (input, output) => {
      await Promise.all(
        hookSets.map((h) => h['command.execute.before']?.(input, output)),
      );
    },
    'experimental.chat.messages.transform': async (input, output) => {
      await Promise.all(
        hookSets.map((h) =>
          h['experimental.chat.messages.transform']?.(input, output),
        ),
      );
    },
    'experimental.chat.system.transform': async (input, output) => {
      await Promise.all(
        hookSets.map((h) =>
          h['experimental.chat.system.transform']?.(input, output),
        ),
      );
    },
    'experimental.session.compacting': async (input, output) => {
      await Promise.all(
        hookSets.map((h) =>
          h['experimental.session.compacting']?.(input, output),
        ),
      );
    },
    'experimental.text.complete': async (input, output) => {
      await Promise.all(
        hookSets.map((h) => h['experimental.text.complete']?.(input, output)),
      );
    },
    'permission.ask': async (input, output) => {
      await Promise.all(
        hookSets.map((h) => h['permission.ask']?.(input, output)),
      );
    },
    'tool.execute.after': async (input, output) => {
      await Promise.all(
        hookSets.map((h) => h['tool.execute.after']?.(input, output)),
      );
    },
    'tool.execute.before': async (input, output) => {
      await Promise.all(
        hookSets.map((h) => h['tool.execute.before']?.(input, output)),
      );
    },
    event: async (input) => {
      await Promise.all(hookSets.map((h) => h.event?.(input)));
    },
  };
};
