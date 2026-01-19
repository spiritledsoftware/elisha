import path from 'node:path';
import defu from 'defu';
import type { ElishaConfigContext } from '..';
import type { McpConfig } from '.';

export const MCP_OPENMEMORY_ID = 'openmemory';

export const getDefaults = (_ctx: ElishaConfigContext): McpConfig => ({
  enabled: true,
  type: 'local',
  command: ['bunx', '-y', 'openmemory-js', 'mcp'],
  environment: {
    OM_DB_PATH: path.resolve(
      path.join(
        process.env.HOME ?? process.env.USERPROFILE ?? '~',
        '.elisha',
        'openmemory.db',
      ),
    ),
  },
});

export const setupOpenMemoryMcpConfig = (ctx: ElishaConfigContext) => {
  ctx.config.mcp ??= {};
  ctx.config.mcp[MCP_OPENMEMORY_ID] = defu(
    ctx.config.mcp?.[MCP_OPENMEMORY_ID] ?? {},
    getDefaults(ctx),
  ) as McpConfig;
};
