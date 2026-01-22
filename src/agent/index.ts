import defu from 'defu';
import type { ElishaConfigContext } from '../types.ts';
import {
  setupArchitectAgentConfig,
  setupArchitectAgentPrompt,
} from './architect.ts';
import {
  setupBrainstormerAgentConfig,
  setupBrainstormerAgentPrompt,
} from './brainstormer.ts';
import { setupCompactionAgentConfig } from './compaction.ts';
import {
  setupConsultantAgentConfig,
  setupConsultantAgentPrompt,
} from './consultant.ts';
import {
  setupDesignerAgentConfig,
  setupDesignerAgentPrompt,
} from './designer.ts';
import {
  setupDocumenterAgentConfig,
  setupDocumenterAgentPrompt,
} from './documenter.ts';
import {
  setupExecutorAgentConfig,
  setupExecutorAgentPrompt,
} from './executor.ts';
import {
  setupExplorerAgentConfig,
  setupExplorerAgentPrompt,
} from './explorer.ts';
import {
  AGENT_ORCHESTRATOR_ID,
  setupOrchestratorAgentConfig,
  setupOrchestratorAgentPrompt,
} from './orchestrator.ts';
import { setupPlannerAgentConfig, setupPlannerAgentPrompt } from './planner.ts';
import {
  setupResearcherAgentConfig,
  setupResearcherAgentPrompt,
} from './researcher.ts';
import {
  setupReviewerAgentConfig,
  setupReviewerAgentPrompt,
} from './reviewer.ts';

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
  setupExplorerAgentConfig(ctx);
  setupResearcherAgentConfig(ctx);
  setupBrainstormerAgentConfig(ctx);
  setupConsultantAgentConfig(ctx);
  setupArchitectAgentConfig(ctx);
  setupPlannerAgentConfig(ctx);
  setupReviewerAgentConfig(ctx);
  setupDocumenterAgentConfig(ctx);
  setupDesignerAgentConfig(ctx);
  setupExecutorAgentConfig(ctx);
  setupOrchestratorAgentConfig(ctx);

  // Add Prompts
  setupExplorerAgentPrompt(ctx);
  setupResearcherAgentPrompt(ctx);
  setupBrainstormerAgentPrompt(ctx);
  setupConsultantAgentPrompt(ctx);
  setupArchitectAgentPrompt(ctx);
  setupPlannerAgentPrompt(ctx);
  setupReviewerAgentPrompt(ctx);
  setupDocumenterAgentPrompt(ctx);
  setupDesignerAgentPrompt(ctx);
  setupExecutorAgentPrompt(ctx);
  setupOrchestratorAgentPrompt(ctx);

  ctx.config.default_agent =
    (ctx.config.agent?.orchestrator?.disable ?? false)
      ? undefined // Don't set a default agent if the orchestrator is disabled
      : AGENT_ORCHESTRATOR_ID;
};
