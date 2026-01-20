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

export const ElishaPlugin: Plugin = async (input: PluginInput) => {
  const hooks = aggregateHooks(
    setupInstructionHooks(input),
    setupMcpHooks(input),
    setupTaskHooks(input),
  );

  return {
    config: async (config: Config) => {
      const ctx: ElishaConfigContext = { ...input, config };
      // MCP first - others may depend on it
      setupMcpConfig(ctx);
      setupAgentConfig(ctx);
      setupPermissionConfig(ctx);
      setupInstructionConfig(ctx);
      setupCommandConfig(ctx);
      setupSkillConfig(ctx);
    },
    tool: await setupTaskTools(input),
    ...hooks,
  };
};
