import { ConfigContext } from '~/context';
import { architectAgent } from './architect';
import { brainstormerAgent } from './brainstormer';
import { consultantAgent } from './consultant';
import { designerAgent } from './designer';
import { documenterAgent } from './documenter';
import { executorAgent } from './executor';
import { explorerAgent } from './explorer';
import { orchestratorAgent } from './orchestrator';
import { plannerAgent } from './planner';
import { researcherAgent } from './researcher';
import { reviewerAgent } from './reviewer';
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
