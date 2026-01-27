import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import { type Config, createOpencodeClient } from '@opencode-ai/sdk/v2';
import { setupAgentConfig } from './agent/config';
import { setupCommandConfig } from './command/config';
import { ConfigContext, PluginContext } from './context';
import { setupHookSet } from './hook/config';
import { setupInstructionConfig } from './instruction/config';
import { setupMcpConfig } from './mcp/config';
import { setupPermissionConfig } from './permission/config';
import { setupSkillConfig } from './skill/config';
import { setupToolSet } from './tool/config';
import type { PluginContext as PluginContextType } from './types';

export const ElishaPlugin: Plugin = async (input: PluginInput) => {
  const client = createOpencodeClient({
    baseUrl: input.serverUrl.toString(),
    directory: input.directory,
    throwOnError: false,
  });
  const ctx: PluginContextType = { ...input, client };
  return await PluginContext.provide(ctx, async () => {
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
};
