import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import { setupInstructionHooks } from './instruction';
import { setupMemoryHooks } from './memory';

export type Hooks = Omit<Awaited<ReturnType<Plugin>>, 'config' | 'tool'>;

export const setupHooks = (ctx: PluginInput): Hooks => {
  const memoryHooks = setupMemoryHooks(ctx);
  const instructionHooks = setupInstructionHooks(ctx);

  return {
    ...memoryHooks,
    ...instructionHooks,
    'chat.message': async (input, output) => {
      await Promise.all([
        memoryHooks['chat.message']?.(input, output),
        instructionHooks['chat.message']?.(input, output),
      ]);
    },
    event: async (input) => {
      await Promise.all([
        memoryHooks.event?.(input),
        instructionHooks.event?.(input),
      ]);
    },
  };
};
