import { defineMcp } from './mcp';

export const chromeDevtoolsMcp = defineMcp({
  id: 'chrome-devtools',
  capabilities: ['Browser Inspection', 'Debugging'],
  config: {
    enabled: true,
    type: 'local',
    command: ['bunx', '-y', 'chrome-devtools-mcp@latest'],
  },
});
