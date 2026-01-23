import { setupMemoryHooks } from '~/features/mcps/openmemory/hook';
import { aggregateHooks } from '~/util/hook';

export const setupMcpHooks = () => {
  const memoryHooks = setupMemoryHooks();
  return aggregateHooks([memoryHooks]);
};
