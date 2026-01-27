import type { PluginInput } from '@opencode-ai/plugin';
import type { Config, OpencodeClient } from '@opencode-ai/sdk/v2';

export type PluginContext = Omit<PluginInput, 'client'> & {
  client: OpencodeClient;
};

export type ConfigContext = Config;
