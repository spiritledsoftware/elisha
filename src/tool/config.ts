import { taskToolSet } from '~/task/tool';
import type { ToolSet } from './types';

const elishaToolSets = [taskToolSet];
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
