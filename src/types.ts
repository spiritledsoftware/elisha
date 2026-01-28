import type { PluginInput } from '@opencode-ai/plugin';
import type { AgentConfig, Config, OpencodeClient } from '@opencode-ai/sdk/v2';

export type PluginContext = Omit<PluginInput, 'client'> & {
  client: OpencodeClient;
};

export type ElishaAgentConfig = AgentConfig & {
  /**
   * Prepend to the agent prompt
   */
  prompt_prepend?: string;
  /**
   * Append to the agent prompt
   */
  prompt_append?: string;
};

export type ElishaConfig = Config & {
  agent?: {
    [key: string]: ElishaAgentConfig | undefined;
  };
};

export type ConfigContext = ElishaConfig;

export type Result<T, E extends Error = Error> =
  | { data: T; error?: never }
  | { data?: never; error: E };
