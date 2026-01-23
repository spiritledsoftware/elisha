import type { Plugin } from '@opencode-ai/plugin';

export type Hooks = Omit<
  Awaited<ReturnType<Plugin>>,
  'config' | 'tool' | 'auth'
>;

export type Tools = Awaited<ReturnType<Plugin>>['tool'];
