import type { ElishaConfigContext } from '../types';

export const setupInstructionConfig = (ctx: ElishaConfigContext) => {
  const instructions = new Set(ctx.config.instructions ?? []);
  instructions.add('AGENTS.md');
  instructions.add('**/AGENTS.md');
  ctx.config.instructions = Array.from(instructions);
};
