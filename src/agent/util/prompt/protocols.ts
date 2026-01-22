import { AGENT_CONSULTANT_ID } from '~/agent/consultant.ts';
import { AGENT_EXPLORER_ID } from '~/agent/explorer.ts';
import { AGENT_RESEARCHER_ID } from '~/agent/researcher.ts';
import {
  MCP_CONTEXT7_ID,
  MCP_EXA_ID,
  MCP_GREP_APP_ID,
  MCP_OPENMEMORY_ID,
} from '~/mcp/index.ts';
import { agentHasPermission } from '~/permission/agent/util.ts';
import type { ElishaConfigContext } from '~/types.ts';
import {
  canAgentDelegate,
  isAgentEnabled,
  isMcpAvailableForAgent,
} from '../index.ts';
import { Prompt } from './index.ts';

export namespace Protocol {
  export const contextGathering = (
    agentName: string,
    ctx: ElishaConfigContext,
  ) => {
    const hasMemory = isMcpAvailableForAgent(MCP_OPENMEMORY_ID, agentName, ctx);
    const hasWebSearch = isMcpAvailableForAgent(MCP_EXA_ID, agentName, ctx);
    const hasWebFetch = agentHasPermission('websearch', agentName, ctx);
    const hasContext7 = isMcpAvailableForAgent(MCP_CONTEXT7_ID, agentName, ctx);
    const hasGrepApp = isAgentEnabled(MCP_GREP_APP_ID, ctx);

    const canDelegate = canAgentDelegate(agentName, ctx);
    const hasExplorer =
      agentName !== AGENT_EXPLORER_ID &&
      canDelegate &&
      isAgentEnabled(AGENT_EXPLORER_ID, ctx);
    const hasResearcher =
      agentName !== AGENT_RESEARCHER_ID &&
      canDelegate &&
      isAgentEnabled(AGENT_RESEARCHER_ID, ctx);

    return Prompt.template`
      ### Context Gathering
      Always gather context before acting:
      ${Prompt.when(
        hasMemory,
        `- Use \`${MCP_OPENMEMORY_ID}*\` for relevant past sessions or info.`,
      )}
      ${Prompt.when(
        hasExplorer,
        `- Delegate to \`${AGENT_EXPLORER_ID}\` agent to search for files or patterns within the codebase.`,
        '- Search for files or patterns within the codebase.',
      )}
      ${Prompt.when(
        hasResearcher,
        `- Delegate to \`${AGENT_RESEARCHER_ID}\` agent to gather external information or perform research.`,
        Prompt.template`
          ${Prompt.when(
            hasWebSearch,
            `- Use \`${MCP_EXA_ID}*\` tools to gather external information from the web.`,
          )}
          ${Prompt.when(
            hasWebFetch,
            `- Use \`webfetch\` tool to retrieve content from specific URLs.`,
          )}
          ${Prompt.when(
            hasContext7,
            `- Use \`${MCP_CONTEXT7_ID}*\` tools to find up-to-date library/package documentation.`,
          )}
          ${Prompt.when(
            hasGrepApp,
            `- Use \`${MCP_GREP_APP_ID}*\` tools to find relevant code snippets or references.`,
          )}
        `,
      )}
    `;
  };

  /**
   * Escalation protocol for agents that can delegate to consultant.
   * Use when the agent might get stuck and needs expert help.
   */
  export const escalation = (agentName: string, ctx: ElishaConfigContext) => {
    const canDelegate = canAgentDelegate(agentName, ctx);
    const hasConsultant =
      agentName !== AGENT_CONSULTANT_ID &&
      canDelegate &&
      isAgentEnabled(AGENT_CONSULTANT_ID, ctx);

    return Prompt.template`
      ### Escalation
      If you encounter a blocker or need help:
      ${Prompt.when(
        hasConsultant,
        `
        - Delegate to \`${AGENT_CONSULTANT_ID}\` agent for specialized assistance.
        `,
        `
        - Report that you need help to proceed.
        `,
      )}
    `;
  };

  /**
   * Standard confidence levels used across agents.
   */
  export const confidence = Prompt.template`
    ### Confidence Levels
    Always state confidence level with findings:
    - **High**: Verified from authoritative source or clear evidence
    - **Medium**: Multiple indicators support this conclusion
    - **Low**: Best guess based on limited information
  `;

  /**
   * Checkpoint protocol for agents that update plans.
   */
  export const checkpoint = Prompt.template`
    ### Checkpoint
    After completing tasks or when stopping, update the plan:
    \`\`\`markdown
    ## Checkpoint
    **Session**: [ISO timestamp]
    **Completed**: [Tasks done]
    **In Progress**: [Current task]
    **Notes**: [Context for next session]
    **Blockers**: [If any]
    \`\`\`
  `;
}
