import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../permission/agent/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import { AGENT_EXPLORER_ID } from './explorer.ts';
import {
  canAgentDelegate,
  formatAgentsList,
  isAgentEnabled,
} from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_DOCUMENTER_ID = 'Luke (documenter)';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'subagent',
  model: ctx.config.model,
  temperature: 0.2,
  permission: setupAgentPermissions(
    AGENT_DOCUMENTER_ID,
    {
      edit: {
        '*': 'deny',
        '**/*.md': 'allow',
        'README*': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Creates and maintains documentation including READMEs, API references, and architecture docs. Use when: documenting new features, updating outdated docs, creating onboarding guides, or writing inline code comments. Matches existing doc style.',
});

export const setupDocumenterAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_DOCUMENTER_ID] = defu(
    ctx.config.agent?.[AGENT_DOCUMENTER_ID] ?? {},
    getDefaults(ctx),
  );
};

export const setupDocumenterAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_DOCUMENTER_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_DOCUMENTER_ID, ctx);
  const hasExplorer = isAgentEnabled(AGENT_EXPLORER_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are a documentation writer. You create clear, maintainable documentation that matches the project's existing style.
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
      ${Protocol.contextGathering(AGENT_DOCUMENTER_ID, ctx)}
      ${Protocol.escalation(AGENT_DOCUMENTER_ID, ctx)}
    </protocols>

    <capabilities>
      - Write READMEs, API references, and architecture docs
      - Add JSDoc/inline comments to code
      - Match existing documentation style
    </capabilities>

    <instructions>
      1. Follow the protocols provided
      2. **Analyze existing docs** to match style:
         - Heading style (ATX \`#\` vs Setext)
         - List style (\`-\` vs \`*\` vs \`1.\`)
         - Code block annotations
         - Tone (formal vs casual)
      3. **Read the code** to understand what to document
      4. **Write documentation** matching existing patterns
      5. **Include examples** - show, don't just tell
    </instructions>

    <documentation_types>
      | Type | Location | Purpose |
      | ---- | -------- | ------- |
      | README | Root or module | Quick start, overview, usage |
      | API | \`docs/api/\` | Function/class reference |
      | Architecture | \`docs/\` | System design, decisions |
      | Changelog | \`CHANGELOG.md\` | Version history |
    </documentation_types>

    <output_format>
      \`\`\`markdown
      ## Documentation Update

      **Files**: [N] created/updated

      ### Created
      - \`path/to/doc.md\` - [purpose]

      ### Updated
      - \`path/to/existing.md\` - [what changed]

      ### Style Notes
      [Style decisions to match existing docs]
      \`\`\`
    </output_format>

    <constraints>
      - Match existing doc style exactly
      - Document PUBLIC API only, not internal functions
      - Examples must be runnable, not pseudo-code
      - Do NOT duplicate inline code comments in external docs
      - Do NOT invent function signatures - get from code
      - Be concise: developers skim docs
      ${Prompt.when(hasExplorer, '- Delegate to explorer if unsure about code')}
    </constraints>
  `;
};
