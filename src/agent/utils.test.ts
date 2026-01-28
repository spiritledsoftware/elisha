import { describe, expect, it } from 'bun:test';
import { formatAgentsList, getEnabledAgents, getSubAgents, hasSubAgents } from '~/agent/utils';
import { ConfigContext } from '~/context';
import { createMockConfig } from '../test-setup';

describe('getEnabledAgents', () => {
  it('returns all agents when none disabled', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'Agent A': { mode: 'subagent', description: 'Agent A desc' },
          'Agent B': { mode: 'subagent', description: 'Agent B desc' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = getEnabledAgents();
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['Agent A', 'Agent B']);
    });
  });

  it('filters out agents with disable: true', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'Agent A': { mode: 'subagent', description: 'Agent A desc' },
          'Agent B': {
            mode: 'subagent',
            description: 'Agent B desc',
            disable: true,
          },
          'Agent C': { mode: 'subagent', description: 'Agent C desc' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = getEnabledAgents();
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['Agent A', 'Agent C']);
    });
  });

  it('returns empty array when no agents configured', () => {
    const ctx = createMockConfig({
      config: {
        agent: {},
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = getEnabledAgents();
      expect(result).toHaveLength(0);
    });
  });

  it('returns empty array when agent config is undefined', () => {
    const ctx = createMockConfig({
      config: {
        agent: undefined,
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = getEnabledAgents();
      expect(result).toHaveLength(0);
    });
  });
});

describe('getSubAgents', () => {
  it('filters out primary mode agents', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'Primary Agent': {
            mode: 'primary',
            description: 'Primary agent desc',
          },
          'Sub Agent': { mode: 'subagent', description: 'Sub agent desc' },
          'All Agent': { mode: 'all', description: 'All agent desc' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = getSubAgents();
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['Sub Agent', 'All Agent']);
    });
  });

  it('filters out agents without descriptions', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'Agent A': { mode: 'subagent', description: 'Has description' },
          'Agent B': { mode: 'subagent' }, // No description
          'Agent C': { mode: 'subagent', description: '' }, // Empty description
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = getSubAgents();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('Agent A');
    });
  });

  it('returns agents suitable for delegation', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          Orchestrator: { mode: 'primary', description: 'Main orchestrator' },
          Explorer: { mode: 'subagent', description: 'Searches codebase' },
          Executor: { mode: 'all', description: 'Implements code' },
          Hidden: { mode: 'subagent' }, // No description, hidden
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = getSubAgents();
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toContain('Explorer');
      expect(result.map((a) => a.id)).toContain('Executor');
      expect(result.map((a) => a.id)).not.toContain('Orchestrator');
      expect(result.map((a) => a.id)).not.toContain('Hidden');
    });
  });
});

describe('hasSubAgents', () => {
  it('returns true when delegatable agents exist', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'Sub Agent': { mode: 'subagent', description: 'Can delegate to' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      expect(hasSubAgents()).toBe(true);
    });
  });

  it('returns false when no delegatable agents', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'Primary Only': { mode: 'primary', description: 'Main agent' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      expect(hasSubAgents()).toBe(false);
    });
  });

  it('returns false when agents have no descriptions', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'No Desc': { mode: 'subagent' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      expect(hasSubAgents()).toBe(false);
    });
  });

  it('returns false when no agents configured', () => {
    const ctx = createMockConfig({
      config: {
        agent: {},
      },
    });

    ConfigContext.provide(ctx, () => {
      expect(hasSubAgents()).toBe(false);
    });
  });
});

describe('formatAgentsList', () => {
  it('returns empty string when no delegatable agents', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'Primary Only': { mode: 'primary', description: 'Main agent' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      expect(formatAgentsList()).toBe(undefined);
    });
  });

  it('formats agents as markdown list with descriptions', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          Explorer: { mode: 'subagent', description: 'Searches the codebase' },
          Executor: { mode: 'all', description: 'Implements code changes' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = formatAgentsList();
      expect(result).toContain('#### **Explorer**:');
      expect(result).toContain('#### **Executor**:');
      expect(result?.split('\n')).toHaveLength(4);
    });
  });

  it('excludes primary mode agents from list', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          Orchestrator: { mode: 'primary', description: 'Main coordinator' },
          Helper: { mode: 'subagent', description: 'Helps with tasks' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = formatAgentsList();
      expect(result).not.toContain('Orchestrator');
      expect(result).toContain('#### **Helper**:\nHelps with tasks');
    });
  });

  it('excludes agents without descriptions', () => {
    const ctx = createMockConfig({
      config: {
        agent: {
          'With Desc': { mode: 'subagent', description: 'Has description' },
          'No Desc': { mode: 'subagent' },
        },
      },
    });

    ConfigContext.provide(ctx, () => {
      const result = formatAgentsList();
      expect(result).toContain('#### **With Desc**:\nHas description');
      expect(result).not.toContain('No Desc');
      expect(result?.split('\n')).toHaveLength(2);
    });
  });
});
