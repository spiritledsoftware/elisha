import { openmemoryMcp } from '~/features/mcps/openmemory';
import { chromeDevtoolsMcp } from '../features/mcps/chrome-devtools';
import { context7Mcp } from '../features/mcps/context7';
import { exaMcp } from '../features/mcps/exa';
import { grepAppMcp } from '../features/mcps/grep-app';

const elishaMcps = [
  chromeDevtoolsMcp,
  context7Mcp,
  exaMcp,
  grepAppMcp,
  openmemoryMcp,
];

export const setupMcpConfig = async () => {
  for (const mcp of elishaMcps) {
    await mcp.setup();
  }
};
