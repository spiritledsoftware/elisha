import { ConfigContext } from '~/context';

export const setupInstructionConfig = () => {
  const config = ConfigContext.use();
  const instructions = new Set(config.instructions ?? []);
  instructions.add('AGENTS.md');
  instructions.add('**/AGENTS.md');
  config.instructions = Array.from(instructions);
};
