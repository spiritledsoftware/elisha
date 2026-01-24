import type {
  PermissionActionConfig,
  PermissionConfig,
  PermissionObjectConfig,
} from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { ConfigContext } from '~/context';
import { chromeDevtoolsMcp } from '~/features/mcps/chrome-devtools';
import { context7Mcp } from '~/features/mcps/context7';
import { exaMcp } from '~/features/mcps/exa';
import { grepAppMcp } from '~/features/mcps/grep-app';
import { openmemoryMcp } from '~/features/mcps/openmemory';
import { taskToolSet } from '~/features/tools/tasks';

function getDefaultPermissions(): PermissionConfig {
  const config = ConfigContext.use();

  const permissions: PermissionConfig = {
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
    [`${taskToolSet.id}*`]: 'allow',
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

  if (config.mcp?.[openmemoryMcp.id]?.enabled ?? true) {
    permissions[`${openmemoryMcp.id}*`] = 'allow';
  }

  if (config.mcp?.[chromeDevtoolsMcp.id]?.enabled ?? true) {
    permissions[`${chromeDevtoolsMcp.id}*`] = 'deny'; // Selectively allow in agents
  }

  return permissions;
}

export function getGlobalPermissions(): PermissionConfig {
  const config = ConfigContext.use();

  if (typeof config.permission !== 'object') {
    return config.permission ?? getDefaultPermissions();
  }
  return defu(config.permission, getDefaultPermissions());
}

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
  permissions: PermissionConfig,
): PermissionConfig => {
  const config = ConfigContext.use();

  if (typeof permissions !== 'object') {
    return permissions;
  }

  const codesearchPermission = permissions.codesearch;
  if (codesearchPermission) {
    if (config.mcp?.[context7Mcp.id]?.enabled ?? true) {
      const context7Permission = permissions[`${context7Mcp.id}*`];
      permissions[`${context7Mcp.id}*`] =
        context7Permission ?? codesearchPermission;
    }

    if (config.mcp?.[grepAppMcp.id]?.enabled ?? true) {
      const grepAppPermission = permissions[`${grepAppMcp.id}*`];
      permissions.codesearch = 'deny'; // Use grep instead
      permissions[`${grepAppMcp.id}*`] =
        grepAppPermission ?? codesearchPermission;
    }
  }

  const websearchPermission = permissions.websearch;
  if (websearchPermission) {
    if (config.mcp?.[exaMcp.id]?.enabled ?? true) {
      const exaPermission = permissions[`${exaMcp.id}*`];
      permissions.websearch = 'deny'; // Use exa instead
      permissions[`${exaMcp.id}*`] = exaPermission ?? websearchPermission;
    }
  }

  return permissions;
};
