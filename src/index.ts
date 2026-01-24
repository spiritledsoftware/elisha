import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';
import { setupAgentConfig } from './agent/config';
import { setupCommandConfig } from './command/config';
import { ConfigContext, PluginContext } from './context';
import { setupHookSet } from './hook/config';
import { setupInstructionConfig } from './instruction/config';
import { setupMcpConfig } from './mcp/config';
import { setupPermissionConfig } from './permission/config';
import { setupSkillConfig } from './skill/config';
import { setupToolSet } from './tool/config';

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
      ...(await setupHookSet()),
    };
  });
