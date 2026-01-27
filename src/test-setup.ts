/**
 * Test setup file - preloaded before all tests
 *
 * Provides common mocks and helpers for testing Elisha plugin components.
 */

import type { PluginInput } from '@opencode-ai/plugin';
import type { Config, OpencodeClient } from '@opencode-ai/sdk/v2';
import type { PluginContext } from './types';

/**
 * Creates a mock OpencodeClient for testing.
 * All methods are stubs that can be overridden as needed.
 */
export const createMockClient = (
  overrides: Partial<OpencodeClient> = {},
): OpencodeClient => {
  return {
    session: {
      create: async () => ({ id: 'test-session-id' }),
      get: async () => ({ id: 'test-session-id' }),
      list: async () => ({ sessions: [] }),
      abort: async () => ({}),
      delete: async () => ({}),
      share: async () => ({ url: 'https://example.com/share' }),
      summarize: async () => ({}),
      compact: async () => ({}),
    },
    message: {
      create: async () => ({ id: 'test-message-id' }),
      list: async () => ({ messages: [] }),
      delete: async () => ({}),
    },
    part: {
      list: async () => ({ parts: [] }),
    },
    config: {
      get: async () => ({}),
      update: async () => ({}),
    },
    file: {
      read: async () => ({ content: '' }),
    },
    event: {
      subscribe: () => ({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'test' };
        },
      }),
    },
    model: {
      list: async () => ({ models: [] }),
    },
    provider: {
      list: async () => ({ providers: [] }),
    },
    installation: {
      get: async () => ({ version: '1.0.0' }),
    },
    agent: {
      list: async () => ({ agents: [] }),
    },
    lsp: {
      definition: async () => ({ locations: [] }),
      references: async () => ({ locations: [] }),
      hover: async () => ({}),
      symbols: async () => ({ symbols: [] }),
      workspaceSymbols: async () => ({ symbols: [] }),
      implementation: async () => ({ locations: [] }),
      callHierarchy: async () => ({ items: [] }),
      incomingCalls: async () => ({ calls: [] }),
      outgoingCalls: async () => ({ calls: [] }),
    },
    ...overrides,
  } as unknown as OpencodeClient;
};

/**
 * Creates a mock PluginInput for testing.
 * Provides sensible defaults that can be overridden.
 */
export const createMockPluginCtx = (
  overrides: Partial<PluginContext> = {},
): PluginContext => {
  return {
    client: createMockClient(),
    project: {
      name: 'test-project',
      path: '/test/project',
    },
    directory: '/test/project',
    worktree: '/test/project',
    serverUrl: new URL('http://localhost:3000'),
    $: (() => {}) as unknown as PluginInput['$'],
    ...overrides,
  } as PluginContext;
};

/**
 * Creates a mock ElishaConfigContext for testing.
 * Combines PluginInput with an empty Config object.
 */
export const createMockConfig = (
  overrides: { input?: Partial<PluginInput>; config?: Partial<Config> } = {},
): Config => {
  const config: Config = {
    model: 'anthropic/claude-sonnet-4-20250514',
    agent: {},
    mcp: {},
    ...overrides.config,
  };

  return config;
};

/**
 * Creates a mock context with a specific agent configured.
 */
export const createMockConfigWithAgent = (
  agentId: string,
  agentConfig: NonNullable<Config['agent']>[string] = {},
  contextOverrides: Parameters<typeof createMockConfig>[0] = {},
): Config => {
  return createMockConfig({
    ...contextOverrides,
    config: {
      ...contextOverrides.config,
      agent: {
        ...contextOverrides.config?.agent,
        [agentId]: agentConfig,
      },
    },
  });
};

/**
 * Creates a mock context with specific MCP servers configured.
 */
export const createMockConfigWithMcp = (
  mcpConfig: Config['mcp'] = {},
  contextOverrides: Parameters<typeof createMockConfig>[0] = {},
): Config => {
  return createMockConfig({
    ...contextOverrides,
    config: {
      ...contextOverrides.config,
      mcp: {
        ...contextOverrides.config?.mcp,
        ...mcpConfig,
      },
    },
  });
};
