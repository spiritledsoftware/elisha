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

/**
 * Converts a wildcard pattern to a regex pattern and tests against input.
 *
 * Wildcard behavior:
 * - `*` matches zero or more characters except colon (segment matching)
 * - `**` matches zero or more characters including colon (path matching)
 * - `?` matches exactly one character
 * - Other regex special characters are escaped
 *
 * Special case (OpenCode compatibility):
 * - Trailing space+wildcard (e.g., "rm *") matches both the command alone ("rm")
 *   and the command with arguments ("rm -rf /"). This is critical for bash patterns.
 */
export const isPatternMatch = (pattern: string, input: string): boolean => {
  // Escape regex special characters except * and ?
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Convert wildcards to regex using placeholders to avoid interference
  // Use Unicode private use area characters as placeholders
  const DOUBLE_STAR = '\uE000'; // Placeholder for **
  const SINGLE_STAR = '\uE001'; // Placeholder for *

  let regexPattern = escaped
    .replace(/\*\*/g, DOUBLE_STAR) // Mark ** first
    .replace(/\*/g, SINGLE_STAR) // Mark remaining *
    .replace(new RegExp(DOUBLE_STAR, 'g'), '.*') // ** matches any path (including colon)
    .replace(new RegExp(SINGLE_STAR, 'g'), '[^:]*') // * matches any characters except colon
    .replace(/\?/g, '.'); // ? matches single character

  // OpenCode compatibility: trailing space+wildcard makes the args optional
  // e.g., "rm *" should match both "rm" and "rm -rf /"
  if (regexPattern.endsWith(' [^:]*')) {
    regexPattern = `${regexPattern.slice(0, -6)}( [^:]*)?`;
  }

  const regex = new RegExp(`^${regexPattern}$`, 's');
  return regex.test(input);
};

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

/**
 * Checks if a permission value allows access (not 'deny').
 * Uses last-match-wins strategy when evaluating multiple rules.
 *
 * **Permissive-by-Default Behavior**:
 * Matches OpenCode's behavior where the default is "ask" (permissive) when no rule matches.
 * This means operations are allowed unless explicitly denied.
 *
 * This means:
 * - If a permission pattern is not found in the config, access is allowed
 * - Agents must explicitly deny permissions they want to restrict
 * - Unknown or new tools are allowed by default
 *
 * @param value - The permission configuration to check
 * @param subPatterns - Remaining pattern segments to match (e.g., ['**\/AGENTS.md'] for edit:**\/AGENTS.md)
 * @returns true if permission is allowed/ask or not found (permissive-by-default), false if denied
 */
export const hasPermission = (
  value: PermissionConfig | PermissionActionConfig | PermissionObjectConfig | string[] | undefined,
  subPatterns: string[] = [],
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
    const inputPattern = subPatterns[0];

    // Last-match-wins: iterate through all keys and track the last matching result
    let lastMatchResult: boolean | undefined;

    for (const [key, keyValue] of Object.entries(value)) {
      // Check if this key matches the input pattern (or vice versa)
      // If no input pattern, we're checking if ANY permission exists
      if (!inputPattern) {
        // No specific pattern requested - recursively check if key grants permission
        const nestedResult = hasPermission(keyValue, []);
        if (nestedResult) {
          lastMatchResult = true;
        }
        continue;
      }

      // Check if the key pattern matches the input
      if (isPatternMatch(key, inputPattern)) {
        lastMatchResult = hasPermission(keyValue, subPatterns.slice(1));
      }
    }

    // Return last match result, or true if no matches (permissive-by-default)
    return lastMatchResult ?? true;
  }

  return false;
};

export const cleanupPermissions = (permissions: PermissionConfig): PermissionConfig => {
  const config = ConfigContext.use();

  if (typeof permissions !== 'object') {
    return permissions;
  }

  const codesearchPermission = permissions.codesearch;
  if (codesearchPermission) {
    if (config.mcp?.[context7Mcp.id]?.enabled ?? true) {
      const context7Permission = permissions[`${context7Mcp.id}*`];
      permissions[`${context7Mcp.id}*`] = context7Permission ?? codesearchPermission;
    }

    if (config.mcp?.[grepAppMcp.id]?.enabled ?? true) {
      const grepAppPermission = permissions[`${grepAppMcp.id}*`];
      permissions.codesearch = 'deny'; // Use grep instead
      permissions[`${grepAppMcp.id}*`] = grepAppPermission ?? codesearchPermission;
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
