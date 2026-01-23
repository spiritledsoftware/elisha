import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';
import { setupAgentConfig } from './agent/config';
import { setupCommandConfig } from './command/config';
import { ConfigContext, PluginContext } from './context';
import { setupTaskHooks } from './features/tools/tasks/hook';
import { setupInstructionConfig } from './instruction/config';
import { setupInstructionHooks } from './instruction/hook';
import { setupMcpConfig } from './mcp/config';
import { setupMcpHooks } from './mcp/hook';
import { setupPermissionConfig } from './permission/config';
import { setupSkillConfig } from './skill/config';
import { setupToolSet } from './tool/config';
import { aggregateHooks } from './util/hook';

export const ElishaPlugin: Plugin = async (ctx: PluginInput) =>
  await PluginContext.provide(ctx, async () => {
    return {
      config: async (config: Config) =>
        // Need to provide PluginContext again due to async boundary
        await PluginContext.provide(
          ctx,
          async () =>
            await ConfigContext.provide(config, async () => {
              await setupMcpConfig();
              await setupAgentConfig();
              setupPermissionConfig();
              setupInstructionConfig();
              setupSkillConfig();
              await setupCommandConfig();
            }),
        ),
      tool: await setupToolSet(),
      ...aggregateHooks([
        setupMcpHooks(),
        setupInstructionHooks(),
        setupTaskHooks(),
      ]),
    };
  });
