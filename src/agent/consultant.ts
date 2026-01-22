import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '~/permission/agent/index.ts';
import type { ElishaConfigContext } from '~/types.ts';
import type { AgentCapabilities } from './types.ts';
import { canAgentDelegate, formatAgentsList } from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_CONSULTANT_ID = 'Ahithopel (consultant)';

export const AGENT_CONSULTANT_CAPABILITIES: AgentCapabilities = {
  task: 'Debugging help',
  description: 'When stuck, need expert guidance',
};

const getDefaultConfig = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'subagent',
  model: ctx.config.model,
  temperature: 0.5,
  permission: setupAgentPermissions(
    AGENT_CONSULTANT_ID,
    {
      edit: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Expert consultant for debugging blockers and solving complex problems. Use when: stuck on a problem, need expert guidance, debugging failures, or evaluating approaches. ADVISORY-ONLY - provides recommendations, not code.',
});

export const setupConsultantAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_CONSULTANT_ID] = defu(
    ctx.config.agent?.[AGENT_CONSULTANT_ID] ?? {},
    getDefaultConfig(ctx),
  );
};

export const setupConsultantAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_CONSULTANT_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_CONSULTANT_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are an expert consultant that helps when agents are stuck on problems. You diagnose issues, identify root causes, and provide actionable guidance to get work unblocked.
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
      ${Protocol.contextGathering(AGENT_CONSULTANT_ID, ctx)}
    </protocols>

    <capabilities>
      - Debug complex problems and diagnose root causes
      - Identify patterns, edge cases, and common failure modes
      - Provide actionable guidance with confidence levels
      - Suggest alternative hypotheses when primary approach fails
    </capabilities>

    <instructions>
      1. **Analyze the problem** - What's the symptom? What was already tried?
      2. **Diagnose root causes** - Identify patterns, check edge cases, consider common failure modes
      3. **Provide actionable steps** - Include confidence level (High/Medium/Low) for each recommendation
      4. **Include alternative hypotheses** - If the primary approach doesn't work, what else could it be?
    </instructions>

    <consultation_output>
      \`\`\`markdown
      ## Problem Analysis
      **Symptom**: [What's happening]
      **Likely Cause**: [Hypothesis] (Confidence: High/Medium/Low)

      ## Recommended Approach
      1. [First step to try]
      2. [Second step]
      3. [Third step]

      ## If That Doesn't Work
      - [Alternative cause]: Try [approach]
      \`\`\`
    </consultation_output>

    <constraints>
      - ADVISORY-ONLY: no file modifications, no code implementation
      - Always state confidence level (High/Medium/Low)
      - Be specific and actionable - vague advice wastes time
      - Do NOT suggest approaches already tried
    </constraints>
  `;
};
