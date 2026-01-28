import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import { chromeDevtoolsMcp } from '~/features/mcps/chrome-devtools';
import { taskCancelTool, taskCreateTool } from '~/features/tools/tasks';
import prompt from './researcher.prompt.md';

export const researcherAgent = defineAgent({
  id: 'Berean (researcher)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'subagent',
      model: config.small_model,
      temperature: 0.5,
      permission: {
        edit: 'deny',
        webfetch: 'allow',
        websearch: 'allow',
        codesearch: 'allow',
        [`${chromeDevtoolsMcp.id}*`]: 'allow',
        // Leaf node - deny delegation
        [taskCreateTool.id]: 'deny',
        [taskCancelTool.id]: 'deny',
      },
      description:
        'An external research specialist for documentation, examples, and best practices.',
    };
  },
  prompt,
});
