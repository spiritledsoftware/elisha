import path from 'node:path';
import { defineMcp } from '~/mcp';
import { getDataDir } from '~/util';

export const openmemoryMcp = defineMcp({
  id: 'openmemory',
  capabilities: ['Persistent Memory', 'Session Context'],
  config: {
    enabled: true,
    type: 'local',
    command: ['bunx', '-y', 'openmemory-js', 'mcp'],
    environment: {
      OM_DB_PATH: path.join(getDataDir(), 'openmemory.db'),
    },
  },
});
