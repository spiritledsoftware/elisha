import { ConfigContext } from '~/context';
import { elishaAgents } from '~/features/agents';
import { executorAgent } from '../features/agents/executor';
import { orchestratorAgent } from '../features/agents/orchestrator';
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

export const setupAgentConfig = async () => {
  const config = ConfigContext.use();

  disableAgent('build');
  disableAgent('plan');
  disableAgent('explore');
  disableAgent('general');

  if (config?.small_model) {
    changeAgentModel('compaction', config.small_model);
  }

  // Setup configs concurrently
  await Promise.all(elishaAgents.map((agent) => agent.setupConfig()));
  // Setup prompts after all configs are set
  await Promise.all(elishaAgents.map((agent) => agent.setupPrompt()));

  setupDefaultAgent();
};
