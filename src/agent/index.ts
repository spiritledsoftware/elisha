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
import { expandAgentPrompts } from './util/index.ts';

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

  // --Elisha agents--
  // Read-only agents
  setupExplorerAgentConfig(ctx);
  setupResearcherAgentConfig(ctx);
  setupBrainstormerAgentConfig(ctx);
  setupArchitectAgentConfig(ctx);

  // Executing agents
  setupPlannerAgentConfig(ctx);
  setupReviewerAgentConfig(ctx);
  setupDocumenterAgentConfig(ctx);
  setupDesignerAgentConfig(ctx);
  setupExecutorAgentConfig(ctx);

  // Main orchestrator
  setupOrchestratorAgentConfig(ctx);

  // Expand all agent prompts AFTER all agents are registered
  // This ensures {{agents}} references see all agents, not just those set up before them
  expandAgentPrompts(ctx);

  ctx.config.default_agent =
    (ctx.config.agent?.orchestrator?.disable ?? false)
      ? undefined // Don't set a default agent if the orchestrator is disabled
      : AGENT_ORCHESTRATOR_ID;
};
