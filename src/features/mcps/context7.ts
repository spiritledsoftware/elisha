import { log } from '~/util';
import { defineMcp } from '../../mcp/mcp';

export const context7Mcp = defineMcp({
  id: 'context7',
  capabilities: ['Library Documentation', 'Up-to-date API references'],
  config: () => {
    if (!process.env.CONTEXT7_API_KEY) {
      log({
        level: 'warn',
        message:
          '[Elisha] CONTEXT7_API_KEY not set - Context7 will use public rate limits',
      });
    }
    return {
      enabled: true,
      type: 'remote',
      url: 'https://mcp.context7.com/mcp',
      headers: process.env.CONTEXT7_API_KEY
        ? { CONTEXT7_API_KEY: process.env.CONTEXT7_API_KEY }
        : undefined,
    };
  },
});
