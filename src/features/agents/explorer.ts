import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import { taskCancelTool, taskCreateTool } from '~/features/tools/tasks';
import prompt from './explorer.prompt.md';

export const explorerAgent = defineAgent({
  id: 'Caleb (explorer)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'subagent',
      model: config.small_model,
      temperature: 0.4,
      permission: {
        edit: 'deny',
        webfetch: 'deny',
        websearch: 'deny',
        codesearch: 'deny',
        // Leaf node - deny delegation
        [taskCreateTool.id]: 'deny',
        [taskCancelTool.id]: 'deny',
      },
      description:
        "Searches and navigates the codebase to find files, patterns, and structure. Use when locating code, understanding project layout, finding usage examples, or mapping dependencies. READ-ONLY - finds and reports, doesn't modify.",
    };
  },
  prompt,
});
