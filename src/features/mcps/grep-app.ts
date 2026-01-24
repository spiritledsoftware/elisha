import { defineMcp } from '../../mcp/mcp';

export const grepAppMcp = defineMcp({
  id: 'grep-app',
  capabilities: ['GitHub Code Search', 'Find real-world examples'],
  config: {
    enabled: true,
    type: 'remote',
    url: 'https://mcp.grep.app',
  },
});
