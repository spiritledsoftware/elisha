import type { Hooks, PluginInput } from '@opencode-ai/plugin';
import { log } from './index.ts';

/**
 * Runs hooks with isolation using Promise.allSettled.
 * Prevents one failing hook from crashing others.
 */
const runHooksWithIsolation = async (
  promises: Array<Promise<unknown> | undefined>,
  ctx: PluginInput,
) => {
  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === 'rejected') {
      await log(
        {
          level: 'error',
          message: `Hook failed: ${result.reason}`,
        },
        ctx,
      );
    }
  }
};

/**
 * Aggregates multiple hook sets into a single Hooks object.
 * Same-named hooks are merged with runHooksWithIsolation for isolated concurrent execution.
 */
export const aggregateHooks = (hookSets: Hooks[], ctx: PluginInput): Hooks => {
  return {
    'chat.params': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h['chat.params']?.(input, output)),
        ctx,
      );
    },
    'chat.message': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h['chat.message']?.(input, output)),
        ctx,
      );
    },
    'command.execute.before': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h['command.execute.before']?.(input, output)),
        ctx,
      );
    },
    'experimental.chat.messages.transform': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) =>
          h['experimental.chat.messages.transform']?.(input, output),
        ),
        ctx,
      );
    },
    'experimental.chat.system.transform': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) =>
          h['experimental.chat.system.transform']?.(input, output),
        ),
        ctx,
      );
    },
    'experimental.session.compacting': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) =>
          h['experimental.session.compacting']?.(input, output),
        ),
        ctx,
      );
    },
    'experimental.text.complete': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h['experimental.text.complete']?.(input, output)),
        ctx,
      );
    },
    'permission.ask': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h['permission.ask']?.(input, output)),
        ctx,
      );
    },
    'tool.execute.after': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h['tool.execute.after']?.(input, output)),
        ctx,
      );
    },
    'tool.execute.before': async (input, output) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h['tool.execute.before']?.(input, output)),
        ctx,
      );
    },
    event: async (input) => {
      await runHooksWithIsolation(
        hookSets.map((h) => h.event?.(input)),
        ctx,
      );
    },
  };
};
