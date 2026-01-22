import type { PluginInput } from '@opencode-ai/plugin';
import { aggregateHooks } from '~/util';
import { setupMemoryHooks } from './openmemory/hook';

export const setupMcpHooks = (ctx: PluginInput) => {
  return aggregateHooks([setupMemoryHooks(ctx)], ctx);
};
