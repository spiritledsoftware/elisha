import path from 'node:path';
import defu from 'defu';
import type { ElishaConfigContext } from '../../types.ts';
import { getDataDir } from '../../util/index.ts';
import type { McpConfig } from '../types.ts';

export const MCP_OPENMEMORY_ID = 'openmemory';

export const getDefaultConfig = (_ctx: ElishaConfigContext): McpConfig => ({
  enabled: true,
  type: 'local',
  command: ['bunx', '-y', 'openmemory-js', 'mcp'],
  environment: {
    OM_DB_PATH: path.join(getDataDir(), 'openmemory.db'),
  },
});

export const setupOpenMemoryMcpConfig = (ctx: ElishaConfigContext) => {
  ctx.config.mcp ??= {};
  ctx.config.mcp[MCP_OPENMEMORY_ID] = defu(
    ctx.config.mcp?.[MCP_OPENMEMORY_ID] ?? {},
    getDefaultConfig(ctx),
  ) as McpConfig;
};
