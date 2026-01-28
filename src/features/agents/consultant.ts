import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './consultant.prompt.md';

export const consultantAgent = defineAgent({
  id: 'Ahithopel (consultant)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'subagent',
      model: config.model,
      temperature: 0.5,
      permission: {
        edit: 'deny',
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
      },
      description: 'An expert consultant for debugging blockers and solving complex problems.',
    };
  },
  prompt,
});
