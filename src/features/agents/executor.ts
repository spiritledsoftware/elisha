import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './executor.prompt.md';

export const executorAgent = defineAgent({
  id: 'Baruch (executor)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'all',
      model: config.model,
      temperature: 0.5,
      permission: {
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
      },
      description:
        'An executor specializing in implementing code changes based on provided plans or instructions. Use when executing plan tasks, writing new code, modifying existing code, or fixing bugs. Does NOT design or plan solutions.',
    };
  },
  prompt,
});
