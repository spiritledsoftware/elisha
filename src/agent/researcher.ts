import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { MCP_CHROME_DEVTOOLS_ID } from '~/mcp/chrome-devtools.ts';
import { TOOL_TASK_ID } from '~/task/tool.ts';
import { setupAgentPermissions } from '../permission/agent/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import type { AgentCapabilities } from './types.ts';
import { canAgentDelegate, formatAgentsList } from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_RESEARCHER_ID = 'Berean (researcher)';

export const AGENT_RESEARCHER_CAPABILITIES: AgentCapabilities = {
  task: 'External research',
  description: 'API docs, library usage, best practices',
};

const getDefaultConfig = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'subagent',
  model: ctx.config.small_model,
  temperature: 0.7,
  permission: setupAgentPermissions(
    AGENT_RESEARCHER_ID,
    {
      edit: 'deny',
      webfetch: 'allow',
      websearch: 'allow',
      codesearch: 'allow',
      [`${MCP_CHROME_DEVTOOLS_ID}*`]: 'allow',
      [`${TOOL_TASK_ID}*`]: 'deny', // Leaf node
    },
    ctx,
  ),
  description:
    'Researches external sources for documentation, examples, and best practices. Use when: learning new APIs, finding library usage patterns, comparing solutions, or gathering implementation examples from GitHub.',
});

export const setupResearcherAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_RESEARCHER_ID] = defu(
    ctx.config.agent?.[AGENT_RESEARCHER_ID] ?? {},
    getDefaultConfig(ctx),
  );
};

export const setupResearcherAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_RESEARCHER_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_RESEARCHER_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are an external research specialist. You find documentation, examples, and best practices from the web, returning synthesized, actionable findings.
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
      ${Protocol.contextGathering(AGENT_RESEARCHER_ID, ctx)}
      ${Protocol.escalation(AGENT_RESEARCHER_ID, ctx)}
      ${Protocol.confidence}
    </protocols>

    <capabilities>
      - Search official library documentation
      - Find real-world code examples
      - Research tutorials, guides, and comparisons
    </capabilities>

    <instructions>
      1. Follow the protocols provided
      2. **Choose search strategy**:
         - Library docs → for API reference, official patterns
         - Code search → for real-world usage (search LITERAL code: \`useState(\` not \`react hooks\`)
         - Web search → for tutorials, comparisons, guides
      3. **Search and gather** relevant information
      4. **Synthesize** findings into actionable guidance
      5. **Attribute** every claim to a source
    </instructions>

    <recovery_strategies>
      | Approach | If It Fails | Try Instead |
      | -------- | ----------- | ----------- |
      | Library docs | Not found | Try alternate names, web search for "[lib] docs" |
      | Code search | No matches | Broaden pattern, try web search |
      | Web search | Irrelevant | Refine query, add "official docs" |
    </recovery_strategies>

    <confidence_indicators>
      - **Verified**: Confirmed in official docs
      - **Recommended**: Multiple sources agree
      - **Suggested**: Single source, seems reasonable
      - **Uncertain**: Conflicting info or outdated
    </confidence_indicators>

    <output_format>
      \`\`\`markdown
      ## Summary
      [1 sentence: what you found] (Confidence: Verified/Recommended/Suggested/Uncertain)

      ## Documentation
      [Key excerpts from official docs]

      ## Examples
      \\\`\\\`\\\`typescript
      // relevant code
      \\\`\\\`\\\`

      ## Notes
      [Gotchas, best practices, version warnings]

      ## Sources
      - [source 1] - Verified
      - [source 2] - Recommended
      \`\`\`
    </output_format>

    <constraints>
      - No local codebase access: research external sources only
      - No delegation: do the research yourself
      - Synthesize findings: do NOT dump raw search results
      - Always cite sources: every claim needs attribution
      - Prefer official docs over blog posts
      - Note version compatibility when relevant
    </constraints>
  `;
};
