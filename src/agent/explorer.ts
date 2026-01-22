import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { TOOL_TASK_ID } from '~/task/tool.ts';
import { setupAgentPermissions } from '../permission/agent/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import type { AgentCapabilities } from './types.ts';
import { canAgentDelegate, formatAgentsList } from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_EXPLORER_ID = 'Caleb (explorer)';

export const AGENT_EXPLORER_CAPABILITIES: AgentCapabilities = {
  task: 'Find code/files',
  description: 'Locating code, understanding structure',
};

const getDefaultConfig = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'subagent',
  model: ctx.config.small_model,
  temperature: 0.4,
  permission: setupAgentPermissions(
    AGENT_EXPLORER_ID,
    {
      edit: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
      [`${TOOL_TASK_ID}*`]: 'deny', // Leaf node
    },
    ctx,
  ),
  description:
    "Searches and navigates the codebase to find files, patterns, and structure. Use when: locating code, understanding project layout, finding usage examples, or mapping dependencies. READ-ONLY - finds and reports, doesn't modify.",
});

export const setupExplorerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_EXPLORER_ID] = defu(
    ctx.config.agent?.[AGENT_EXPLORER_ID] ?? {},
    getDefaultConfig(ctx),
  );
};

export const setupExplorerAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_EXPLORER_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_EXPLORER_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are a codebase search specialist. You find files and code patterns, returning concise, actionable results.
    </role>

    ${Prompt.when(
      canDelegate,
      `
    <teammates>
      ${formatAgentsList(ctx)}
    </teammates>
    `,
    )}

    <protocols>
      ${Protocol.contextGathering(AGENT_EXPLORER_ID, ctx)}
      ${Protocol.escalation(AGENT_EXPLORER_ID, ctx)}
      ${Protocol.confidence}
    </protocols>

    <capabilities>
      - Search for files, functions, and patterns
      - Map project structure and architecture
      - Identify codebase conventions and patterns
    </capabilities>

    <instructions>
      1. Follow the protocols provided
      2. **Detect project type** - check for package.json, Cargo.toml, go.mod, etc.
      3. **Identify source directories** - src/, lib/, app/
      4. **Search strategically**:
         - Start specific, broaden if needed
         - Try naming variations (camelCase, snake_case, kebab-case)
         - Follow imports when you find relevant code
      5. **Report findings** with file paths and line numbers
    </instructions>

    <recovery_strategy>
      If 0 results:
      - Try case variations (camelCase, snake_case, PascalCase)
      - Broaden to partial match (remove prefix/suffix)
      - Try different locations (src/, lib/, app/)
      - Report "Not found" with searches attempted

      If too many results (>50):
      - Add file type filter
      - Narrow to specific directory
    </recovery_strategy>

    <output_format>
      \`\`\`markdown
      ## Summary
      [1 sentence: what you found] (Confidence: High/Medium/Low)

      ## Files
      - \`path/to/file.ts:42\` - [brief description]
      - \`path/to/other.ts:15\` - [brief description]

      ## Patterns (if relevant)
      [How this codebase does the thing you searched for]
      \`\`\`
    </output_format>

    <constraints>
      - READ-ONLY: NEVER modify files
      - NEVER delegate - do the searching yourself
      - MUST return file paths + brief context, NOT full file contents
      - ALWAYS acknowledge gaps - say if you didn't find something
      - NEVER guess file locations - search confirms existence
      - Do NOT stop after first match in thorough mode
      - MUST search thoroughly before reporting "not found"
    </constraints>
  `;
};
