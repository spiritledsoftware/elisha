import type { ElishaConfigContext } from '../types.ts';
import { setupChromeDevtoolsMcpConfig } from './chrome-devtools.ts';
import { setupContext7McpConfig } from './context7.ts';
import { setupExaMcpConfig } from './exa.ts';
import { setupGrepAppMcpConfig } from './grep-app.ts';
import { setupOpenMemoryMcpConfig } from './openmemory.ts';

export const setupMcpConfig = (ctx: ElishaConfigContext) => {
  setupOpenMemoryMcpConfig(ctx);
  setupContext7McpConfig(ctx);
  setupExaMcpConfig(ctx);
  setupGrepAppMcpConfig(ctx);
  setupChromeDevtoolsMcpConfig(ctx);
};
