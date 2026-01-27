import { elishaMcps } from '~/features/mcps';

export const setupMcpConfig = async () => {
  await Promise.all(elishaMcps.map(async (mcp) => await mcp.setup()));
};
