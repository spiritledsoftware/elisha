import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './architect.prompt.md';

export const architectAgent = defineAgent({
  id: 'Bezalel (architect)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'all',
      model: config.model,
      temperature: 0.5,
      permission: {
        edit: {
          '*': 'deny',
          '.agent/specs/*.md': 'allow',
        },
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
      },
      description: 'Creates architectural specs and designs solutions with clear tradeoffs.',
    };
  },
  prompt,
});
