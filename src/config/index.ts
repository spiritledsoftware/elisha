import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';
import { setupAgentConfig } from './agent';
import { setupCommandConfig } from './command';
import { setupInstructionConfig } from './instruction';
import { setupMcpConfig } from './mcp';
import { setupPermissionConfig } from './permission';
import { setupSkillConfig } from './skill';
import type { ElishaConfigContext } from './types';

type ConfigFn = Awaited<ReturnType<Plugin>>['config'];

export const setupConfig = (ctx: PluginInput): ConfigFn => {
  return async (config: Config) => {
    const configCtx: ElishaConfigContext = { ...ctx, config };

    setupMcpConfig(configCtx);
    setupAgentConfig(configCtx);
    setupPermissionConfig(configCtx);
    setupInstructionConfig(configCtx);
    setupSkillConfig(configCtx);
    setupCommandConfig(configCtx);
  };
};

export type * from './types';
