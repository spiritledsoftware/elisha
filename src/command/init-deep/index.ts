import defu from 'defu';
import type { ElishaConfigContext } from '../../types.ts';
import type { CommandConfig } from '../types.ts';

import PROMPT from './prompt.md';

export const COMMAND_INIT_DEEP_ID = 'init-deep';

const getDefaults = (_ctx: ElishaConfigContext): CommandConfig => ({
  template: PROMPT,
  description: 'Initialize AGENTS.md instructions within the current project',
});

export const setupInitDeepCommandConfig = (ctx: ElishaConfigContext) => {
  ctx.config.command ??= {};
  ctx.config.command[COMMAND_INIT_DEEP_ID] = defu(
    ctx.config.command?.[COMMAND_INIT_DEEP_ID] ?? {},
    getDefaults(ctx),
  );
};
