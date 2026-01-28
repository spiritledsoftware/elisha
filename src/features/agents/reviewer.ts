import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './reviewer.prompt.md';

export const reviewerAgent = defineAgent({
  id: 'Elihu (reviewer)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'all',
      model: config.model,
      temperature: 0.2,
      permission: {
        edit: {
          '*': 'deny',
          '.agent/reviews/*.md': 'allow',
        },
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
      },
      description: 'Reviews code changes for bugs, security issues, and style violations.',
    };
  },
  prompt,
});
