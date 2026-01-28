import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './brainstormer.prompt.md';

export const brainstormerAgent = defineAgent({
  id: 'Jubal (brainstormer)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'all',
      model: config.model,
      temperature: 1.0,
      permission: {
        edit: 'deny',
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
      },
      description:
        'A creative ideation specialist for generating diverse ideas and fresh approaches.',
    };
  },
  prompt,
});
