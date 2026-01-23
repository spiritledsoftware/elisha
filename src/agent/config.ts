import { ConfigContext } from '~/context';
import { architectAgent } from '../features/agents/architect';
import { brainstormerAgent } from '../features/agents/brainstormer';
import { consultantAgent } from '../features/agents/consultant';
import { designerAgent } from '../features/agents/designer';
import { documenterAgent } from '../features/agents/documenter';
import { executorAgent } from '../features/agents/executor';
import { explorerAgent } from '../features/agents/explorer';
import { orchestratorAgent } from '../features/agents/orchestrator';
import { plannerAgent } from '../features/agents/planner';
import { researcherAgent } from '../features/agents/researcher';
import { reviewerAgent } from '../features/agents/reviewer';
import { changeAgentModel, disableAgent } from './util';

const setupDefaultAgent = () => {
  const config = ConfigContext.use();

  // Already defined
  if (config.default_agent) {
    return;
  }

  // Prefer orchestrator or executor if available
  if (config.agent?.[orchestratorAgent.id]?.disable !== true) {
    config.default_agent = orchestratorAgent.id;
  } else if (config.agent?.[executorAgent.id]?.disable !== true) {
    config.default_agent = executorAgent.id;
  }
  // Otherwise, user defines at runtime
};

const elishaAgents = [
  architectAgent,
  brainstormerAgent,
  consultantAgent,
  designerAgent,
  documenterAgent,
  executorAgent,
  explorerAgent,
  orchestratorAgent,
  plannerAgent,
  researcherAgent,
  reviewerAgent,
];

export const setupAgentConfig = async () => {
  const config = ConfigContext.use();

  disableAgent('build');
  disableAgent('plan');
  disableAgent('explore');
  disableAgent('general');
  changeAgentModel('compaction', config.small_model);

  for (const agent of elishaAgents) {
    await agent.setupConfig();
  }
  // Setup prompts after all configs are set
  for (const agent of elishaAgents) {
    await agent.setupPrompt();
  }

  setupDefaultAgent();
};
