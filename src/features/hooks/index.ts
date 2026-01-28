import { memoryHooks } from '~/features/mcps/openmemory/hooks';
import { taskHooks } from '~/features/tools/tasks/hooks';
import type { ElishaHookSet } from '~/hook';
import { worktreeHooks } from './worktree';

/**
 * Array of all Elisha hook sets.
 */
export const elishaHooks: ElishaHookSet[] = [taskHooks, memoryHooks, worktreeHooks];
