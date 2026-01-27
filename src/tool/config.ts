import { elishaToolSets } from '~/features/tools';
import type { ToolSet } from './types';

export const setupToolSet = async (): Promise<ToolSet> => {
  const results = await Promise.all(
    elishaToolSets.map(async (toolSet) => await toolSet.setup()),
  );
  return Object.assign({}, ...results);
};
