/**
 * Tests for permission utilities - security-critical code
 *
 * Tests cover:
 * - hasPermission: Permission value evaluation
 * - agentHasPermission: Agent-specific permission checks with wildcards
 * - cleanupPermissions: MCP permission propagation
 * - getGlobalPermissions: Permission merging with defaults
 */

import { describe, expect, it } from 'bun:test';
import type {
  PermissionConfig,
  PermissionObjectConfig,
} from '@opencode-ai/sdk/v2';
import { MCP_CONTEXT7_ID } from '~/mcp/context7.ts';
import { MCP_EXA_ID } from '~/mcp/exa.ts';
import { MCP_GREP_APP_ID } from '~/mcp/grep-app.ts';
import {
  agentHasPermission,
  getAgentPermissions,
} from '~/permission/agent/util.ts';
import { getGlobalPermissions } from '~/permission/index.ts';
import { cleanupPermissions, hasPermission } from '~/permission/util.ts';
import {
  createMockContext,
  createMockContextWithAgent,
  createMockContextWithMcp,
} from '../test-setup.ts';

/**
 * Helper to cast PermissionConfig to object form for property access in tests.
 * The cleanupPermissions function always returns an object when given an object.
 */
const asObject = (config: PermissionConfig): PermissionObjectConfig =>
  config as PermissionObjectConfig;

describe('hasPermission', () => {
  describe('handles undefined/null values', () => {
    it('returns false for undefined', () => {
      expect(hasPermission(undefined)).toBe(false);
    });

    it('returns false for null (cast as undefined)', () => {
      expect(hasPermission(null as unknown as undefined)).toBe(false);
    });
  });

  describe('handles string values', () => {
    it('returns false for "deny"', () => {
      expect(hasPermission('deny')).toBe(false);
    });

    it('returns true for "allow"', () => {
      expect(hasPermission('allow')).toBe(true);
    });

    it('returns true for "ask"', () => {
      expect(hasPermission('ask')).toBe(true);
    });
  });

  describe('handles array values', () => {
    it('returns false when all values are "deny"', () => {
      expect(hasPermission(['deny', 'deny', 'deny'])).toBe(false);
    });

    it('returns true when at least one value is "allow"', () => {
      expect(hasPermission(['deny', 'allow', 'deny'])).toBe(true);
    });

    it('returns true when at least one value is "ask"', () => {
      expect(hasPermission(['deny', 'ask', 'deny'])).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(hasPermission([])).toBe(false);
    });
  });

  describe('handles nested object values', () => {
    it('returns false when all nested values are "deny"', () => {
      const config: PermissionConfig = {
        bash: 'deny',
        edit: 'deny',
      };
      expect(hasPermission(config)).toBe(false);
    });

    it('returns true when at least one nested value is "allow"', () => {
      const config: PermissionConfig = {
        bash: 'deny',
        edit: 'allow',
      };
      expect(hasPermission(config)).toBe(true);
    });

    it('returns true when deeply nested value is "allow"', () => {
      const config: PermissionConfig = {
        bash: {
          '*': 'deny',
          'git *': 'allow',
        },
        edit: 'deny',
      };
      expect(hasPermission(config)).toBe(true);
    });

    it('returns false when all deeply nested values are "deny"', () => {
      const config: PermissionConfig = {
        bash: {
          '*': 'deny',
          'rm *': 'deny',
        },
        edit: 'deny',
      };
      expect(hasPermission(config)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(hasPermission({})).toBe(false);
    });
  });
});

describe('getAgentPermissions', () => {
  it('returns empty object when agent has no permissions', () => {
    const ctx = createMockContext();
    expect(getAgentPermissions('nonexistent-agent', ctx)).toEqual({});
  });

  it('returns empty object when agent exists but has no permission config', () => {
    const ctx = createMockContextWithAgent('test-agent', {});
    expect(getAgentPermissions('test-agent', ctx)).toEqual({});
  });

  it('returns agent permissions when configured', () => {
    const permissions: PermissionConfig = {
      edit: 'allow',
      bash: 'deny',
    };
    const ctx = createMockContextWithAgent('test-agent', {
      permission: permissions,
    });
    expect(getAgentPermissions('test-agent', ctx)).toEqual(permissions);
  });
});

describe('agentHasPermission', () => {
  describe('default behavior (no permissions defined)', () => {
    it('returns true when agent has no permissions defined', () => {
      const ctx = createMockContext();
      expect(agentHasPermission('edit', 'nonexistent-agent', ctx)).toBe(true);
    });

    it('returns true when agent exists but has no permission config', () => {
      const ctx = createMockContextWithAgent('test-agent', {});
      expect(agentHasPermission('edit', 'test-agent', ctx)).toBe(true);
    });
  });

  describe('exact permission matches', () => {
    it('returns false when permission is "deny"', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { edit: 'deny' },
      });
      expect(agentHasPermission('edit', 'test-agent', ctx)).toBe(false);
    });

    it('returns true when permission is "allow"', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { edit: 'allow' },
      });
      expect(agentHasPermission('edit', 'test-agent', ctx)).toBe(true);
    });

    it('returns true when permission is "ask"', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { edit: 'ask' },
      });
      expect(agentHasPermission('edit', 'test-agent', ctx)).toBe(true);
    });
  });

  describe('wildcard pattern matching', () => {
    it('matches wildcard permission to specific tool (openmemory* -> openmemory_query)', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { 'openmemory*': 'allow' },
      });
      expect(agentHasPermission('openmemory_query', 'test-agent', ctx)).toBe(
        true,
      );
    });

    it('matches wildcard permission to specific tool (openmemory* -> openmemory_store)', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { 'openmemory*': 'deny' },
      });
      expect(agentHasPermission('openmemory_store', 'test-agent', ctx)).toBe(
        false,
      );
    });

    it('matches wildcard permission to wildcard pattern (openmemory* -> openmemory*)', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { 'openmemory*': 'allow' },
      });
      expect(agentHasPermission('openmemory*', 'test-agent', ctx)).toBe(true);
    });

    it('matches chrome-devtools wildcard pattern', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { 'chrome-devtools*': 'allow' },
      });
      expect(
        agentHasPermission('chrome-devtools_screenshot', 'test-agent', ctx),
      ).toBe(true);
    });

    it('matches elisha_task wildcard pattern', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { 'elisha_task*': 'deny' },
      });
      expect(agentHasPermission('elisha_task_output', 'test-agent', ctx)).toBe(
        false,
      );
    });

    it('does not match unrelated patterns', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: { 'openmemory*': 'deny' },
      });
      // edit is not covered by openmemory*, so should return true (default allow)
      expect(agentHasPermission('edit', 'test-agent', ctx)).toBe(true);
    });
  });

  describe('exact match takes precedence', () => {
    it('uses exact match over wildcard when both exist', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: {
          'openmemory*': 'allow',
          openmemory_query: 'deny',
        },
      });
      expect(agentHasPermission('openmemory_query', 'test-agent', ctx)).toBe(
        false,
      );
    });
  });

  describe('string permission config', () => {
    it('returns true when permission config is "allow" string', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: 'allow' as unknown as PermissionConfig,
      });
      expect(agentHasPermission('edit', 'test-agent', ctx)).toBe(true);
    });

    it('returns false when permission config is "deny" string', () => {
      const ctx = createMockContextWithAgent('test-agent', {
        permission: 'deny' as unknown as PermissionConfig,
      });
      expect(agentHasPermission('edit', 'test-agent', ctx)).toBe(false);
    });
  });
});

describe('cleanupPermissions', () => {
  describe('codesearch permission propagation', () => {
    it('propagates codesearch to context7 when enabled', () => {
      const ctx = createMockContextWithMcp({
        [MCP_CONTEXT7_ID]: { enabled: true },
        [MCP_GREP_APP_ID]: { enabled: false },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_CONTEXT7_ID}*`]).toBe('ask');
    });

    it('propagates codesearch to grep-app when enabled', () => {
      const ctx = createMockContextWithMcp({
        [MCP_CONTEXT7_ID]: { enabled: false },
        [MCP_GREP_APP_ID]: { enabled: true },
      });
      const config: PermissionConfig = { codesearch: 'allow' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_GREP_APP_ID}*`]).toBe('allow');
    });

    it('sets codesearch to deny after propagating to grep-app', () => {
      const ctx = createMockContextWithMcp({
        [MCP_GREP_APP_ID]: { enabled: true },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result.codesearch).toBe('deny');
    });

    it('does not propagate to context7 when disabled', () => {
      const ctx = createMockContextWithMcp({
        [MCP_CONTEXT7_ID]: { enabled: false },
        [MCP_GREP_APP_ID]: { enabled: false },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_CONTEXT7_ID}*`]).toBeUndefined();
    });

    it('does not propagate to grep-app when disabled', () => {
      const ctx = createMockContextWithMcp({
        [MCP_CONTEXT7_ID]: { enabled: false },
        [MCP_GREP_APP_ID]: { enabled: false },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_GREP_APP_ID}*`]).toBeUndefined();
    });

    it('does not overwrite existing context7 permission', () => {
      const ctx = createMockContextWithMcp({
        [MCP_CONTEXT7_ID]: { enabled: true },
      });
      const config: PermissionConfig = {
        codesearch: 'ask',
        [`${MCP_CONTEXT7_ID}*`]: 'deny',
      };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_CONTEXT7_ID}*`]).toBe('deny');
    });

    it('does not overwrite existing grep-app permission', () => {
      const ctx = createMockContextWithMcp({
        [MCP_GREP_APP_ID]: { enabled: true },
      });
      const config: PermissionConfig = {
        codesearch: 'ask',
        [`${MCP_GREP_APP_ID}*`]: 'allow',
      };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_GREP_APP_ID}*`]).toBe('allow');
    });

    it('propagates to both context7 and grep-app when both enabled', () => {
      const ctx = createMockContextWithMcp({
        [MCP_CONTEXT7_ID]: { enabled: true },
        [MCP_GREP_APP_ID]: { enabled: true },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_CONTEXT7_ID}*`]).toBe('ask');
      expect(result[`${MCP_GREP_APP_ID}*`]).toBe('ask');
      expect(result.codesearch).toBe('deny');
    });
  });

  describe('websearch permission propagation', () => {
    it('propagates websearch to exa when enabled', () => {
      const ctx = createMockContextWithMcp({
        [MCP_EXA_ID]: { enabled: true },
      });
      const config: PermissionConfig = { websearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_EXA_ID}*`]).toBe('ask');
    });

    it('sets websearch to deny after propagating to exa', () => {
      const ctx = createMockContextWithMcp({
        [MCP_EXA_ID]: { enabled: true },
      });
      const config: PermissionConfig = { websearch: 'allow' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result.websearch).toBe('deny');
    });

    it('does not propagate to exa when disabled', () => {
      const ctx = createMockContextWithMcp({
        [MCP_EXA_ID]: { enabled: false },
      });
      const config: PermissionConfig = { websearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_EXA_ID}*`]).toBeUndefined();
      expect(result.websearch).toBe('ask'); // Unchanged
    });

    it('does not overwrite existing exa permission', () => {
      const ctx = createMockContextWithMcp({
        [MCP_EXA_ID]: { enabled: true },
      });
      const config: PermissionConfig = {
        websearch: 'ask',
        [`${MCP_EXA_ID}*`]: 'deny',
      };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_EXA_ID}*`]).toBe('deny');
    });
  });

  describe('edge cases', () => {
    it('returns config unchanged when not an object', () => {
      const ctx = createMockContext();
      const config = 'allow' as unknown as PermissionConfig;
      const result = cleanupPermissions(config, ctx);

      expect(result).toBe('allow');
    });

    it('handles missing codesearch permission', () => {
      const ctx = createMockContextWithMcp({
        [MCP_CONTEXT7_ID]: { enabled: true },
      });
      const config: PermissionConfig = { edit: 'allow' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_CONTEXT7_ID}*`]).toBeUndefined();
      expect(result.edit).toBe('allow');
    });

    it('handles missing websearch permission', () => {
      const ctx = createMockContextWithMcp({
        [MCP_EXA_ID]: { enabled: true },
      });
      const config: PermissionConfig = { edit: 'allow' };
      const result = asObject(cleanupPermissions(config, ctx));

      expect(result[`${MCP_EXA_ID}*`]).toBeUndefined();
      expect(result.edit).toBe('allow');
    });

    it('defaults to enabled when MCP config is missing', () => {
      const ctx = createMockContext(); // No MCP config
      const config: PermissionConfig = { codesearch: 'ask', websearch: 'ask' };
      const result = asObject(cleanupPermissions(config, ctx));

      // Should propagate since default is enabled
      expect(result[`${MCP_CONTEXT7_ID}*`]).toBe('ask');
      expect(result[`${MCP_GREP_APP_ID}*`]).toBe('ask');
      expect(result[`${MCP_EXA_ID}*`]).toBe('ask');
    });
  });
});

describe('getGlobalPermissions', () => {
  describe('default permissions', () => {
    it('returns default permissions when no user config', () => {
      const ctx = createMockContext();
      const permissions = asObject(getGlobalPermissions(ctx));

      // Check some key defaults
      expect(permissions.edit).toBe('allow');
      expect(permissions.glob).toBe('allow');
      expect(permissions.grep).toBe('allow');
      expect(permissions.task).toBe('deny');
      expect(permissions.codesearch).toBe('ask');
      expect(permissions.websearch).toBe('ask');
      expect(permissions.webfetch).toBe('ask');
    });

    it('includes bash permissions with dangerous patterns denied', () => {
      const ctx = createMockContext();
      const permissions = asObject(getGlobalPermissions(ctx));
      const bashPerms = permissions.bash as unknown as Record<string, string>;

      expect(bashPerms['*']).toBe('allow');
      expect(bashPerms['rm * /']).toBe('deny');
      expect(bashPerms['rm * ~']).toBe('deny');
      expect(bashPerms['rm -rf *']).toBe('deny');
      expect(bashPerms['chmod 777 *']).toBe('deny');
      expect(bashPerms['chown * /']).toBe('deny');
      expect(bashPerms['dd if=* of=/dev/*']).toBe('deny');
      expect(bashPerms['mkfs*']).toBe('deny');
      expect(bashPerms['> /dev/*']).toBe('deny');
    });

    it('includes read permissions with .env files denied', () => {
      const ctx = createMockContext();
      const permissions = asObject(getGlobalPermissions(ctx));
      const readPerms = permissions.read as unknown as Record<string, string>;

      expect(readPerms['*']).toBe('allow');
      expect(readPerms['*.env']).toBe('deny');
      expect(readPerms['*.env.*']).toBe('deny');
      expect(readPerms['*.env.example']).toBe('allow');
    });

    it('includes elisha_task permission', () => {
      const ctx = createMockContext();
      const permissions = asObject(getGlobalPermissions(ctx));

      expect(permissions['elisha_task*']).toBe('allow');
    });
  });

  describe('user config merging', () => {
    it('merges user config with defaults using defu', () => {
      const ctx = createMockContext({
        config: {
          permission: {
            edit: 'deny', // Override default
            custom_tool: 'allow', // Add new
          },
        },
      });
      const permissions = asObject(getGlobalPermissions(ctx));

      expect(permissions.edit).toBe('deny'); // User override
      expect(permissions.custom_tool).toBe('allow'); // User addition
      expect(permissions.glob).toBe('allow'); // Default preserved
    });

    it('user overrides take precedence over defaults', () => {
      const ctx = createMockContext({
        config: {
          permission: {
            websearch: 'allow', // Override 'ask' default
            webfetch: 'deny', // Override 'ask' default
          },
        },
      });
      const permissions = asObject(getGlobalPermissions(ctx));

      expect(permissions.websearch).toBe('allow');
      expect(permissions.webfetch).toBe('deny');
    });

    it('deeply merges nested permission objects', () => {
      const ctx = createMockContext({
        config: {
          permission: {
            bash: {
              'npm *': 'deny', // Add new pattern
            },
          },
        },
      });
      const permissions = asObject(getGlobalPermissions(ctx));
      const bashPerms = permissions.bash as unknown as Record<string, string>;

      // User addition
      expect(bashPerms['npm *']).toBe('deny');
      // Defaults preserved
      expect(bashPerms['*']).toBe('allow');
      expect(bashPerms['rm -rf *']).toBe('deny');
    });

    it('returns user permission directly when not an object', () => {
      const ctx = createMockContext({
        config: {
          permission: 'allow' as unknown as PermissionConfig,
        },
      });
      const permissions = getGlobalPermissions(ctx);

      expect(permissions).toBe('allow');
    });
  });

  describe('MCP-dependent permissions', () => {
    it('includes openmemory permission when enabled', () => {
      const ctx = createMockContextWithMcp({
        openmemory: { enabled: true },
      });
      const permissions = asObject(getGlobalPermissions(ctx));

      expect(permissions['openmemory*']).toBe('allow');
    });

    it('excludes openmemory permission when disabled', () => {
      const ctx = createMockContextWithMcp({
        openmemory: { enabled: false },
      });
      const permissions = asObject(getGlobalPermissions(ctx));

      expect(permissions['openmemory*']).toBeUndefined();
    });

    it('includes chrome-devtools permission (denied by default) when enabled', () => {
      const ctx = createMockContextWithMcp({
        'chrome-devtools': { enabled: true },
      });
      const permissions = asObject(getGlobalPermissions(ctx));

      expect(permissions['chrome-devtools*']).toBe('deny');
    });

    it('excludes chrome-devtools permission when disabled', () => {
      const ctx = createMockContextWithMcp({
        'chrome-devtools': { enabled: false },
      });
      const permissions = asObject(getGlobalPermissions(ctx));

      expect(permissions['chrome-devtools*']).toBeUndefined();
    });
  });
});
