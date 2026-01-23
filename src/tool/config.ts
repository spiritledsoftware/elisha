import { elishaToolSets } from '~/features/tools';
import type { ToolSet } from './types';

export const setupToolSet = async () => {
  let tools: ToolSet = {};
  for (const toolSet of elishaToolSets) {
    const newTools = await toolSet.setup();
    tools = {
      ...tools,
      ...newTools,
    };
  }
  return tools;
};
