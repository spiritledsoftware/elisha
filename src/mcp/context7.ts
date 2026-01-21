import defu from 'defu';
import { log } from '~/util/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import type { McpConfig } from './types.ts';

export const MCP_CONTEXT7_ID = 'context7';

export const getDefaults = (_ctx: ElishaConfigContext): McpConfig => ({
  enabled: true,
  type: 'remote',
  url: 'https://mcp.context7.com/mcp',
  headers: process.env.CONTEXT7_API_KEY
    ? { CONTEXT7_API_KEY: process.env.CONTEXT7_API_KEY }
    : undefined,
});

export const setupContext7McpConfig = (ctx: ElishaConfigContext) => {
  if (!process.env.CONTEXT7_API_KEY) {
    log(
      {
        level: 'warn',
        message:
          '[Elisha] CONTEXT7_API_KEY not set - Context7 will use public rate limits',
      },
      ctx,
    );
  }
  ctx.config.mcp ??= {};
  ctx.config.mcp[MCP_CONTEXT7_ID] = defu(
    ctx.config.mcp?.[MCP_CONTEXT7_ID] ?? {},
    getDefaults(ctx),
  ) as McpConfig;
};
