import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import { chromeDevtoolsMcp } from '~/features/mcps/chrome-devtools';
import prompt from './designer.prompt.md';

export const designerAgent = defineAgent({
  id: 'Oholiab (designer)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'all',
      model: config.model,
      temperature: 0.7,
      permission: {
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
        [`${chromeDevtoolsMcp.id}*`]: 'allow',
      },
      description: 'A UI/UX implementation specialist focused on bold, distinctive aesthetics.',
    };
  },
  prompt,
});
