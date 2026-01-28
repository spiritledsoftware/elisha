import { defineMcp } from '~/mcp';
import { log } from '~/utils';

export const exaMcp = defineMcp({
  id: 'exa',
  capabilities: ['Web Search', 'Deep Research'],
  config: () => {
    if (!process.env.EXA_API_KEY) {
      log({
        level: 'warn',
        message: '[Elisha] EXA_API_KEY not set - Exa search will use public rate limits',
      });
    }
    return {
      enabled: true,
      type: 'remote',
      url: 'https://mcp.exa.ai/mcp?tools=web_search_exa,deep_search_exa',
      headers: process.env.EXA_API_KEY ? { 'x-api-key': process.env.EXA_API_KEY } : undefined,
    };
  },
});
