import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './documenter.prompt.md';

export const documenterAgent = defineAgent({
  id: 'Luke (documenter)',
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
          '**/*.md': 'allow',
          'README*': 'allow',
        },
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
      },
      description:
        'A technical writer focused on creating clear, maintainable documentation. Use when documenting new features, updating outdated docs, creating onboarding guides, or writing inline code comments.',
    };
  },
  prompt,
});
