import { elishaMcps } from '~/features/mcps';

export const setupMcpConfig = async () => {
  for (const mcp of elishaMcps) {
    await mcp.setup();
  }
};
