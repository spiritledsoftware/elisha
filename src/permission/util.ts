import type {
  PermissionActionConfig,
  PermissionConfig,
  PermissionObjectConfig,
} from '@opencode-ai/sdk/v2';
import { MCP_CONTEXT7_ID, MCP_EXA_ID, MCP_GREP_APP_ID } from '~/mcp';
import type { ElishaConfigContext } from '~/types';

export const hasPermission = (
  value:
    | PermissionConfig
    | PermissionActionConfig
    | PermissionObjectConfig
    | string[]
    | undefined,
): boolean => {
  if (!value) {
    return false;
  }
  if (typeof value === 'string') {
    return value !== 'deny';
  }
  if (Array.isArray(value)) {
    return value.some((v) => v !== 'deny');
  }
  if (typeof value === 'object') {
    return Object.values(value).some(hasPermission);
  }

  return false;
};

export const cleanupPermissions = (
  config: PermissionConfig,
  ctx: ElishaConfigContext,
): PermissionConfig => {
  if (typeof config !== 'object') {
    return config;
  }

  const codesearchPermission = config.codesearch;
  if (codesearchPermission) {
    if (ctx.config.mcp?.[MCP_CONTEXT7_ID]?.enabled ?? true) {
      const context7Permission = config[`${MCP_CONTEXT7_ID}*`];
      config[`${MCP_CONTEXT7_ID}*`] =
        context7Permission ?? codesearchPermission;
    }

    if (ctx.config.mcp?.[MCP_GREP_APP_ID]?.enabled ?? true) {
      const grepAppPermission = config[`${MCP_GREP_APP_ID}*`];
      config.codesearch = 'deny'; // Use grep instead
      config[`${MCP_GREP_APP_ID}*`] = grepAppPermission ?? codesearchPermission;
    }
  }

  const websearchPermission = config.websearch;
  if (websearchPermission) {
    if (ctx.config.mcp?.[MCP_EXA_ID]?.enabled ?? true) {
      const exaPermission = config[`${MCP_EXA_ID}*`];
      config.websearch = 'deny'; // Use exa instead
      config[`${MCP_EXA_ID}*`] = exaPermission ?? websearchPermission;
    }
  }

  return config;
};
