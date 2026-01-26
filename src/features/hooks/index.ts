import { memoryHooks } from '~/features/mcps/openmemory/hooks';
import { taskHooks } from '~/features/tools/tasks/hooks';
import type { ElishaHookSet } from '~/hook';

/**
 * Array of all Elisha hook sets.
 */
export const elishaHooks: ElishaHookSet[] = [taskHooks, memoryHooks];
