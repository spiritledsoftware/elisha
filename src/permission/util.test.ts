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
import { ConfigContext } from '~/context';
import { context7Mcp } from '~/mcp/context7';
import { exaMcp } from '~/mcp/exa';
import { grepAppMcp } from '~/mcp/grep-app';
import {
  cleanupPermissions,
  getGlobalPermissions,
  hasPermission,
} from '~/permission/util';
import { createMockConfig, createMockConfigWithMcp } from '../test-setup';

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

describe('cleanupPermissions', () => {
  describe('codesearch permission propagation', () => {
    it('propagates codesearch to context7 when enabled', () => {
      const ctx = createMockConfigWithMcp({
        [context7Mcp.id]: { enabled: true },
        [grepAppMcp.id]: { enabled: false },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${context7Mcp.id}*`]).toBe('ask');
      });
    });

    it('propagates codesearch to grep-app when enabled', () => {
      const ctx = createMockConfigWithMcp({
        [context7Mcp.id]: { enabled: false },
        [grepAppMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = { codesearch: 'allow' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${grepAppMcp.id}*`]).toBe('allow');
      });
    });

    it('sets codesearch to deny after propagating to grep-app', () => {
      const ctx = createMockConfigWithMcp({
        [grepAppMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result.codesearch).toBe('deny');
      });
    });

    it('does not propagate to context7 when disabled', () => {
      const ctx = createMockConfigWithMcp({
        [context7Mcp.id]: { enabled: false },
        [grepAppMcp.id]: { enabled: false },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${context7Mcp.id}*`]).toBeUndefined();
      });
    });

    it('does not propagate to grep-app when disabled', () => {
      const ctx = createMockConfigWithMcp({
        [context7Mcp.id]: { enabled: false },
        [grepAppMcp.id]: { enabled: false },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${grepAppMcp.id}*`]).toBeUndefined();
      });
    });

    it('does not overwrite existing context7 permission', () => {
      const ctx = createMockConfigWithMcp({
        [context7Mcp.id]: { enabled: true },
      });
      const config: PermissionConfig = {
        codesearch: 'ask',
        [`${context7Mcp.id}*`]: 'deny',
      };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${context7Mcp.id}*`]).toBe('deny');
      });
    });

    it('does not overwrite existing grep-app permission', () => {
      const ctx = createMockConfigWithMcp({
        [grepAppMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = {
        codesearch: 'ask',
        [`${grepAppMcp.id}*`]: 'allow',
      };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${grepAppMcp.id}*`]).toBe('allow');
      });
    });

    it('propagates to both context7 and grep-app when both enabled', () => {
      const ctx = createMockConfigWithMcp({
        [context7Mcp.id]: { enabled: true },
        [grepAppMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = { codesearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${context7Mcp.id}*`]).toBe('ask');
        expect(result[`${grepAppMcp.id}*`]).toBe('ask');
        expect(result.codesearch).toBe('deny');
      });
    });
  });

  describe('websearch permission propagation', () => {
    it('propagates websearch to exa when enabled', () => {
      const ctx = createMockConfigWithMcp({
        [exaMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = { websearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${exaMcp.id}*`]).toBe('ask');
      });
    });

    it('sets websearch to deny after propagating to exa', () => {
      const ctx = createMockConfigWithMcp({
        [exaMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = { websearch: 'allow' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result.websearch).toBe('deny');
      });
    });

    it('does not propagate to exa when disabled', () => {
      const ctx = createMockConfigWithMcp({
        [exaMcp.id]: { enabled: false },
      });
      const config: PermissionConfig = { websearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${exaMcp.id}*`]).toBeUndefined();
        expect(result.websearch).toBe('ask'); // Unchanged
      });
    });

    it('does not overwrite existing exa permission', () => {
      const ctx = createMockConfigWithMcp({
        [exaMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = {
        websearch: 'ask',
        [`${exaMcp.id}*`]: 'deny',
      };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${exaMcp.id}*`]).toBe('deny');
      });
    });
  });

  describe('edge cases', () => {
    it('returns config unchanged when not an object', () => {
      const ctx = createMockConfig();
      const config = 'allow' as unknown as PermissionConfig;
      ConfigContext.provide(ctx, () => {
        const result = cleanupPermissions(config);
        expect(result).toBe('allow');
      });
    });

    it('handles missing codesearch permission', () => {
      const ctx = createMockConfigWithMcp({
        [context7Mcp.id]: { enabled: true },
      });
      const config: PermissionConfig = { edit: 'allow' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${context7Mcp.id}*`]).toBeUndefined();
        expect(result.edit).toBe('allow');
      });
    });

    it('handles missing websearch permission', () => {
      const ctx = createMockConfigWithMcp({
        [exaMcp.id]: { enabled: true },
      });
      const config: PermissionConfig = { edit: 'allow' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        expect(result[`${exaMcp.id}*`]).toBeUndefined();
        expect(result.edit).toBe('allow');
      });
    });

    it('defaults to enabled when MCP config is missing', () => {
      const ctx = createMockConfig(); // No MCP config
      const config: PermissionConfig = { codesearch: 'ask', websearch: 'ask' };
      ConfigContext.provide(ctx, () => {
        const result = asObject(cleanupPermissions(config));
        // Should propagate since default is enabled
        expect(result[`${context7Mcp.id}*`]).toBe('ask');
        expect(result[`${grepAppMcp.id}*`]).toBe('ask');
        expect(result[`${exaMcp.id}*`]).toBe('ask');
      });
    });
  });
});

describe('getGlobalPermissions', () => {
  describe('default permissions', () => {
    it('returns default permissions when no user config', () => {
      const ctx = createMockConfig();
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());

        // Check some key defaults
        expect(permissions.edit).toBe('allow');
        expect(permissions.glob).toBe('allow');
        expect(permissions.grep).toBe('allow');
        expect(permissions.task).toBe('deny');
        expect(permissions.codesearch).toBe('ask');
        expect(permissions.websearch).toBe('ask');
        expect(permissions.webfetch).toBe('ask');
      });
    });

    it('includes bash permissions with dangerous patterns denied', () => {
      const ctx = createMockConfig();
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
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
    });

    it('includes read permissions with .env files denied', () => {
      const ctx = createMockConfig();
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
        const readPerms = permissions.read as unknown as Record<string, string>;

        expect(readPerms['*']).toBe('allow');
        expect(readPerms['*.env']).toBe('deny');
        expect(readPerms['*.env.*']).toBe('deny');
        expect(readPerms['*.env.example']).toBe('allow');
      });
    });

    it('includes elisha_task permission', () => {
      const ctx = createMockConfig();
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
        expect(permissions['elisha_task*']).toBe('allow');
      });
    });
  });

  describe('user config merging', () => {
    it('merges user config with defaults using defu', () => {
      const ctx = createMockConfig({
        config: {
          permission: {
            edit: 'deny', // Override default
            custom_tool: 'allow', // Add new
          },
        },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());

        expect(permissions.edit).toBe('deny'); // User override
        expect(permissions.custom_tool).toBe('allow'); // User addition
        expect(permissions.glob).toBe('allow'); // Default preserved
      });
    });

    it('user overrides take precedence over defaults', () => {
      const ctx = createMockConfig({
        config: {
          permission: {
            websearch: 'allow', // Override 'ask' default
            webfetch: 'deny', // Override 'ask' default
          },
        },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());

        expect(permissions.websearch).toBe('allow');
        expect(permissions.webfetch).toBe('deny');
      });
    });

    it('deeply merges nested permission objects', () => {
      const ctx = createMockConfig({
        config: {
          permission: {
            bash: {
              'npm *': 'deny', // Add new pattern
            },
          },
        },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
        const bashPerms = permissions.bash as unknown as Record<string, string>;

        // User addition
        expect(bashPerms['npm *']).toBe('deny');
        // Defaults preserved
        expect(bashPerms['*']).toBe('allow');
        expect(bashPerms['rm -rf *']).toBe('deny');
      });
    });

    it('returns user permission directly when not an object', () => {
      const ctx = createMockConfig({
        config: {
          permission: 'allow' as unknown as PermissionConfig,
        },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = getGlobalPermissions();
        expect(permissions).toBe('allow');
      });
    });
  });

  describe('MCP-dependent permissions', () => {
    it('includes openmemory permission when enabled', () => {
      const ctx = createMockConfigWithMcp({
        openmemory: { enabled: true },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
        expect(permissions['openmemory*']).toBe('allow');
      });
    });

    it('excludes openmemory permission when disabled', () => {
      const ctx = createMockConfigWithMcp({
        openmemory: { enabled: false },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
        expect(permissions['openmemory*']).toBeUndefined();
      });
    });

    it('includes chrome-devtools permission (denied by default) when enabled', () => {
      const ctx = createMockConfigWithMcp({
        'chrome-devtools': { enabled: true },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
        expect(permissions['chrome-devtools*']).toBe('deny');
      });
    });

    it('excludes chrome-devtools permission when disabled', () => {
      const ctx = createMockConfigWithMcp({
        'chrome-devtools': { enabled: false },
      });
      ConfigContext.provide(ctx, () => {
        const permissions = asObject(getGlobalPermissions());
        expect(permissions['chrome-devtools*']).toBeUndefined();
      });
    });
  });
});
