import { memoryHooks } from '~/features/mcps/openmemory/hook';
import { taskHooks } from '~/features/tools/tasks/hook';
import type { ElishaHookSet } from '~/hook';
import { instructionHooks } from '~/instruction/hook';

/**
 * Array of all Elisha hook sets.
 */
export const elishaHooks: ElishaHookSet[] = [
  instructionHooks,
  taskHooks,
  memoryHooks,
];
