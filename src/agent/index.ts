import defu from 'defu';
import type { ElishaConfigContext } from '../types.ts';
import { setupArchitectAgentConfig } from './architect/index.ts';
import { setupBrainstormerAgentConfig } from './brainstormer/index.ts';
import { setupCompactionAgentConfig } from './compaction/index.ts';
import { setupDesignerAgentConfig } from './designer/index.ts';
import { setupDocumenterAgentConfig } from './documenter/index.ts';
import { setupExecutorAgentConfig } from './executor/index.ts';
import { setupExplorerAgentConfig } from './explorer/index.ts';
import {
  AGENT_ORCHESTRATOR_ID,
  setupOrchestratorAgentConfig,
} from './orchestrator/index.ts';
import { setupPlannerAgentConfig } from './planner/index.ts';
import { setupResearcherAgentConfig } from './researcher/index.ts';
import { setupReviewerAgentConfig } from './reviewer/index.ts';
import { setupTesterAgentConfig } from './tester/index.ts';

const disableAgent = (name: string, ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[name] = defu(ctx.config.agent?.[name] ?? {}, {
    disable: true,
  });
};

export const setupAgentConfig = (ctx: ElishaConfigContext) => {
  disableAgent('build', ctx);
  disableAgent('plan', ctx);
  disableAgent('explore', ctx);
  disableAgent('general', ctx);

  setupCompactionAgentConfig(ctx);

  // Elisha agents
  setupArchitectAgentConfig(ctx);
  setupBrainstormerAgentConfig(ctx);
  setupDesignerAgentConfig(ctx);
  setupDocumenterAgentConfig(ctx);
  setupExecutorAgentConfig(ctx);
  setupExplorerAgentConfig(ctx);
  setupOrchestratorAgentConfig(ctx);
  setupPlannerAgentConfig(ctx);
  setupResearcherAgentConfig(ctx);
  setupReviewerAgentConfig(ctx);
  setupTesterAgentConfig(ctx);

  ctx.config.default_agent =
    (ctx.config.agent?.orchestrator?.disable ?? false)
      ? undefined // Don't set a default agent if the orchestrator is disabled
      : AGENT_ORCHESTRATOR_ID;
};
