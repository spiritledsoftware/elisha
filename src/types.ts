import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';

export type ElishaConfigContext = PluginInput & { config: Config };

export type Hooks = Omit<
  Awaited<ReturnType<Plugin>>,
  'config' | 'tool' | 'auth'
>;

export type Tools = Awaited<ReturnType<Plugin>>['tool'];
