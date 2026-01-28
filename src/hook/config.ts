import { elishaHooks } from '~/features/hooks';
import type { Hooks } from './types';
import { aggregateHooks } from './utils';

export const setupHookSet = async (): Promise<Hooks> => {
  const hookSets = await Promise.all(elishaHooks.map(async (hookSet) => await hookSet.setup()));

  return aggregateHooks(hookSets);
};
