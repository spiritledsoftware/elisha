import { log } from '~/util';
import type { Hooks } from './types';

/**
 * Runs hooks with isolation using Promise.allSettled.
 * Prevents one failing hook from crashing others.
 */
const runHooksWithIsolation = async (
  promises: Array<Promise<unknown> | undefined>,
) => {
  const settled = await Promise.allSettled(promises);
  for (const result of settled) {
    if (result.status === 'rejected') {
      await log({
        level: 'error',
        message: `Hook failed: ${result.reason}`,
      });
    }
  }
};

const HOOK_NAMES: Array<keyof Hooks> = [
  'chat.params',
  'chat.message',
  'command.execute.before',
  'experimental.chat.messages.transform',
  'experimental.chat.system.transform',
  'experimental.session.compacting',
  'experimental.text.complete',
  'permission.ask',
  'tool.execute.after',
  'tool.execute.before',
  'event',
];

type HookFn = (...args: unknown[]) => Promise<void> | void;

/**
 * Aggregates multiple hook sets into a single Hooks object.
 * Same-named hooks are merged with runHooksWithIsolation for isolated concurrent execution.
 */
export const aggregateHooks = (hookSets: Array<Partial<Hooks>>): Hooks => {
  return Object.fromEntries(
    HOOK_NAMES.map((name) => [
      name,
      async (...args: unknown[]) =>
        runHooksWithIsolation(
          hookSets.map(async (h) => {
            const hook = h[name] as HookFn | undefined;
            return await hook?.(...args);
          }),
        ),
    ]),
  ) as Hooks;
};
