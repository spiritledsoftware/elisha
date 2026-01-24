import { elishaHooks } from '~/features/hooks';
import type { Hooks } from './types';
import { aggregateHooks } from './util';

export const setupHookSet = async (): Promise<Hooks> => {
  const hookSets = await Promise.all(
    elishaHooks.map((hookSet) => hookSet.setup()),
  );

  return aggregateHooks(hookSets);
};
