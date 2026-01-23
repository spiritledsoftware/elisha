import { chromeDevtoolsMcp } from './chrome-devtools';
import { context7Mcp } from './context7';
import { exaMcp } from './exa';
import { grepAppMcp } from './grep-app';
import { openmemoryMcp } from './openmemory';

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
