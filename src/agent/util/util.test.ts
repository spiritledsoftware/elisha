import { describe, expect, it } from 'bun:test';
import {
  canAgentDelegate,
  formatAgentsList,
  getEnabledAgents,
  getSubAgents,
  hasSubAgents,
  isAgentEnabled,
  isMcpAvailableForAgent,
} from '~/agent/util/index.ts';
import { createMockContext } from '../../test-setup.ts';

describe('getEnabledAgents', () => {
  it('returns all agents when none disabled', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Agent A': { mode: 'subagent', description: 'Agent A desc' },
          'Agent B': { mode: 'subagent', description: 'Agent B desc' },
        },
      },
    });

    const result = getEnabledAgents(ctx);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toEqual(['Agent A', 'Agent B']);
  });

  it('filters out agents with disable: true', () => {
    const ctx = createMockContext({
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

    const result = getEnabledAgents(ctx);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toEqual(['Agent A', 'Agent C']);
  });

  it('returns empty array when no agents configured', () => {
    const ctx = createMockContext({
      config: {
        agent: {},
      },
    });

    const result = getEnabledAgents(ctx);

    expect(result).toHaveLength(0);
  });

  it('returns empty array when agent config is undefined', () => {
    const ctx = createMockContext({
      config: {
        agent: undefined,
      },
    });

    const result = getEnabledAgents(ctx);

    expect(result).toHaveLength(0);
  });
});

describe('getSubAgents', () => {
  it('filters out primary mode agents', () => {
    const ctx = createMockContext({
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

    const result = getSubAgents(ctx);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toEqual(['Sub Agent', 'All Agent']);
  });

  it('filters out agents without descriptions', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Agent A': { mode: 'subagent', description: 'Has description' },
          'Agent B': { mode: 'subagent' }, // No description
          'Agent C': { mode: 'subagent', description: '' }, // Empty description
        },
      },
    });

    const result = getSubAgents(ctx);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Agent A');
  });

  it('returns agents suitable for delegation', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          Orchestrator: { mode: 'primary', description: 'Main orchestrator' },
          Explorer: { mode: 'subagent', description: 'Searches codebase' },
          Executor: { mode: 'all', description: 'Implements code' },
          Hidden: { mode: 'subagent' }, // No description, hidden
        },
      },
    });

    const result = getSubAgents(ctx);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toContain('Explorer');
    expect(result.map((a) => a.name)).toContain('Executor');
    expect(result.map((a) => a.name)).not.toContain('Orchestrator');
    expect(result.map((a) => a.name)).not.toContain('Hidden');
  });
});

describe('hasSubAgents', () => {
  it('returns true when delegatable agents exist', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Sub Agent': { mode: 'subagent', description: 'Can delegate to' },
        },
      },
    });

    expect(hasSubAgents(ctx)).toBe(true);
  });

  it('returns false when no delegatable agents', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Primary Only': { mode: 'primary', description: 'Main agent' },
        },
      },
    });

    expect(hasSubAgents(ctx)).toBe(false);
  });

  it('returns false when agents have no descriptions', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'No Desc': { mode: 'subagent' },
        },
      },
    });

    expect(hasSubAgents(ctx)).toBe(false);
  });

  it('returns false when no agents configured', () => {
    const ctx = createMockContext({
      config: {
        agent: {},
      },
    });

    expect(hasSubAgents(ctx)).toBe(false);
  });
});

describe('canAgentDelegate', () => {
  it('returns false when no sub-agents available', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Test Agent': {
            mode: 'primary',
            description: 'Only primary agent',
            permission: { 'elisha_task*': 'allow' },
          },
        },
      },
    });

    expect(canAgentDelegate('Test Agent', ctx)).toBe(false);
  });

  it('returns false when agent lacks task permission', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Test Agent': {
            mode: 'subagent',
            description: 'Test agent',
            permission: { 'elisha_task*': 'deny', task: 'deny' },
          },
          'Other Agent': {
            mode: 'subagent',
            description: 'Available for delegation',
          },
        },
      },
    });

    expect(canAgentDelegate('Test Agent', ctx)).toBe(false);
  });

  it('returns true when both conditions met with elisha_task permission', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Test Agent': {
            mode: 'subagent',
            description: 'Test agent',
            permission: { 'elisha_task*': 'allow' },
          },
          'Other Agent': {
            mode: 'subagent',
            description: 'Available for delegation',
          },
        },
      },
    });

    const result = canAgentDelegate('Test Agent', ctx);
    expect(result).toBe(true);
  });

  it('returns true when both conditions met with task permission', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Test Agent': {
            mode: 'subagent',
            description: 'Test agent',
            permission: { task: 'allow' },
          },
          'Other Agent': {
            mode: 'subagent',
            description: 'Available for delegation',
          },
        },
      },
    });

    expect(canAgentDelegate('Test Agent', ctx)).toBe(true);
  });

  it('returns true when agent has no explicit permission (defaults to allow)', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Test Agent': {
            mode: 'subagent',
            description: 'Test agent',
            permission: {},
          },
          'Other Agent': {
            mode: 'subagent',
            description: 'Available for delegation',
          },
        },
      },
    });

    expect(canAgentDelegate('Test Agent', ctx)).toBe(true);
  });
});

describe('isMcpAvailableForAgent', () => {
  it('returns false when MCP is disabled', () => {
    const ctx = createMockContext({
      config: {
        mcp: {
          'test-mcp': { enabled: false, command: ['test'] },
        },
        agent: {
          'Test Agent': {
            mode: 'subagent',
            permission: { 'test-mcp*': 'allow' },
          },
        },
      },
    });

    expect(isMcpAvailableForAgent('test-mcp', 'Test Agent', ctx)).toBe(false);
  });

  it("returns false when agent permission is 'deny'", () => {
    const ctx = createMockContext({
      config: {
        mcp: {
          'test-mcp': { enabled: true, command: ['test'] },
        },
        agent: {
          'Test Agent': {
            mode: 'subagent',
            permission: { 'test-mcp*': 'deny' },
          },
        },
      },
    });

    expect(isMcpAvailableForAgent('test-mcp', 'Test Agent', ctx)).toBe(false);
  });

  it('returns true when MCP enabled and permission allows', () => {
    const ctx = createMockContext({
      config: {
        mcp: {
          'test-mcp': { enabled: true, command: ['test'] },
        },
        agent: {
          'Test Agent': {
            mode: 'subagent',
            permission: { 'test-mcp*': 'allow' },
          },
        },
      },
    });

    expect(isMcpAvailableForAgent('test-mcp', 'Test Agent', ctx)).toBe(true);
  });

  it('returns true when MCP has no explicit enabled flag (defaults to true)', () => {
    const ctx = createMockContext({
      config: {
        mcp: {
          'test-mcp': { type: 'local', command: ['test'] },
        },
        agent: {
          'Test Agent': {
            mode: 'subagent',
            permission: { 'test-mcp*': 'allow' },
          },
        },
      },
    });

    expect(isMcpAvailableForAgent('test-mcp', 'Test Agent', ctx)).toBe(true);
  });

  it('returns true when agent has no explicit permission (defaults to allow)', () => {
    const ctx = createMockContext({
      config: {
        mcp: {
          'test-mcp': { enabled: true, command: ['test'] },
        },
        agent: {
          'Test Agent': {
            mode: 'subagent',
            permission: {},
          },
        },
      },
    });

    expect(isMcpAvailableForAgent('test-mcp', 'Test Agent', ctx)).toBe(true);
  });
});

describe('isAgentEnabled', () => {
  it('returns true when agent exists and is not disabled', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Test Agent': { mode: 'subagent' },
        },
      },
    });

    expect(isAgentEnabled('Test Agent', ctx)).toBe(true);
  });

  it('returns false when agent is disabled', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Test Agent': { mode: 'subagent', disable: true },
        },
      },
    });

    expect(isAgentEnabled('Test Agent', ctx)).toBe(false);
  });

  it('returns false when agent does not exist', () => {
    const ctx = createMockContext({
      config: {
        agent: {},
      },
    });

    expect(isAgentEnabled('Nonexistent Agent', ctx)).toBe(false);
  });
});

describe('formatAgentsList', () => {
  it('returns empty string when no delegatable agents', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'Primary Only': { mode: 'primary', description: 'Main agent' },
        },
      },
    });

    expect(formatAgentsList(ctx)).toBe('');
  });

  it('formats agents as markdown list with descriptions', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          Explorer: { mode: 'subagent', description: 'Searches the codebase' },
          Executor: { mode: 'all', description: 'Implements code changes' },
        },
      },
    });

    const result = formatAgentsList(ctx);

    expect(result).toContain('- **Explorer**: Searches the codebase');
    expect(result).toContain('- **Executor**: Implements code changes');
    expect(result.split('\n')).toHaveLength(2);
  });

  it('excludes primary mode agents from list', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          Orchestrator: { mode: 'primary', description: 'Main coordinator' },
          Helper: { mode: 'subagent', description: 'Helps with tasks' },
        },
      },
    });

    const result = formatAgentsList(ctx);

    expect(result).not.toContain('Orchestrator');
    expect(result).toContain('- **Helper**: Helps with tasks');
  });

  it('excludes agents without descriptions', () => {
    const ctx = createMockContext({
      config: {
        agent: {
          'With Desc': { mode: 'subagent', description: 'Has description' },
          'No Desc': { mode: 'subagent' },
        },
      },
    });

    const result = formatAgentsList(ctx);

    expect(result).toContain('- **With Desc**: Has description');
    expect(result).not.toContain('No Desc');
    expect(result.split('\n')).toHaveLength(1);
  });
});
