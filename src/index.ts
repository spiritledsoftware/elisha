import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';
import { setupAgentConfig } from './agent/index.ts';
import { setupCommandConfig } from './command/index.ts';
import {
  setupInstructionConfig,
  setupInstructionHooks,
} from './instruction/index.ts';
import { setupMcpConfig, setupMcpHooks } from './mcp/index.ts';
import { setupPermissionConfig } from './permission/index.ts';
import { setupSkillConfig } from './skill/index.ts';
import { setupTaskHooks, setupTaskTools } from './task/index.ts';
import type { ElishaConfigContext } from './types.ts';
import { aggregateHooks } from './util/hooks.ts';

export const ElishaPlugin: Plugin = async (ctx: PluginInput) => {
  return {
    config: async (config: Config) => {
      const configCtx: ElishaConfigContext = { ...ctx, config };
      // MCP first - others may depend on it
      setupMcpConfig(configCtx);
      setupAgentConfig(configCtx);
      setupPermissionConfig(configCtx);
      setupInstructionConfig(configCtx);
      setupCommandConfig(configCtx);
      setupSkillConfig(configCtx);
    },
    tool: await setupTaskTools(ctx),
    ...aggregateHooks(
      [setupInstructionHooks(ctx), setupMcpHooks(ctx), setupTaskHooks(ctx)],
      ctx,
    ),
  };
};
