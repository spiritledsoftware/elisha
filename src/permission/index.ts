import type { PermissionConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { MCP_CHROME_DEVTOOLS_ID } from '../mcp/chrome-devtools.ts';
import { MCP_OPENMEMORY_ID } from '../mcp/openmemory/index.ts';
import { TOOL_TASK_ID } from '../task/tool.ts';
import type { ElishaConfigContext } from '../types.ts';
import { cleanupPermissions } from './util.ts';

const getDefaultPermissions = (ctx: ElishaConfigContext): PermissionConfig => {
  const config: PermissionConfig = {
    bash: {
      '*': 'allow',
      'rm * /': 'deny',
      'rm * ~': 'deny',
      'rm -rf *': 'deny',
      'chmod 777 *': 'deny',
      'chown * /': 'deny',
      'dd if=* of=/dev/*': 'deny',
      'mkfs*': 'deny',
      '> /dev/*': 'deny',
    },
    codesearch: 'ask', // Always ask before performing code searches
    doom_loop: 'ask',
    edit: 'allow',
    [`${TOOL_TASK_ID}*`]: 'allow',
    external_directory: 'ask', // Always ask before accessing external directories
    glob: 'allow',
    grep: 'allow',
    list: 'allow',
    lsp: 'allow',
    question: 'allow',
    read: {
      '*': 'allow',
      '*.env': 'deny',
      '*.env.*': 'deny',
      '*.env.example': 'allow',
    },
    task: 'deny', // Use elisha's task tools instead
    todoread: 'allow',
    todowrite: 'allow',
    webfetch: 'ask', // Always ask before fetching from the web
    websearch: 'ask', // Always ask before performing web searches
  };

  if (ctx.config.mcp?.[MCP_OPENMEMORY_ID]?.enabled ?? true) {
    config[`${MCP_OPENMEMORY_ID}*`] = 'allow';
  }

  if (ctx.config.mcp?.[MCP_CHROME_DEVTOOLS_ID]?.enabled ?? true) {
    config[`${MCP_CHROME_DEVTOOLS_ID}*`] = 'deny'; // Selectively allow in agents
  }

  return config;
};

export const getGlobalPermissions = (
  ctx: ElishaConfigContext,
): PermissionConfig => {
  if (typeof ctx.config.permission !== 'object') {
    return ctx.config.permission ?? getDefaultPermissions(ctx);
  }
  return defu(ctx.config.permission, getDefaultPermissions(ctx));
};

export const setupPermissionConfig = (ctx: ElishaConfigContext) => {
  ctx.config.permission = cleanupPermissions(getGlobalPermissions(ctx), ctx);
};
