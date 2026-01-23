import { aggregateHooks } from '~/util/hook';
import { setupMemoryHooks } from './openmemory/hook';

export const setupMcpHooks = () => {
  const memoryHooks = setupMemoryHooks();
  return aggregateHooks([memoryHooks]);
};
