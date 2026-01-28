import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './planner.prompt.md';

export const plannerAgent = defineAgent({
  id: 'Ezra (planner)',
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
          '.agent/plans/*.md': 'allow',
        },
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
      },
      description:
        'Creates structured implementation plans from requirements or specs. Use when starting a new feature, breaking down complex work, or need ordered task lists with acceptance criteria. Writes detailed plans, does NOT implement code.',
    };
  },
  prompt,
});
