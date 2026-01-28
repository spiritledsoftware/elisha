import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './orchestrator.prompt.md';

export const orchestratorAgent = defineAgent({
  id: 'Jethro (orchestrator)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'all',
      model: config.model,
      temperature: 0.4,
      permission: {
        codesearch: 'deny',
        edit: 'deny',
        webfetch: 'deny',
        websearch: 'deny',
      },
      description:
        'Coordinates complex multi-step tasks requiring multiple specialists. Use when task spans multiple domains, requires parallel work, or needs result aggregation. NEVER writes code.',
    };
  },
  prompt,
});
