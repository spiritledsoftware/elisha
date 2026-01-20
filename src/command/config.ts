import type { ElishaConfigContext } from '../types.ts';
import { setupInitDeepCommandConfig } from './init-deep/index.ts';

export const setupCommandConfig = (ctx: ElishaConfigContext) => {
  setupInitDeepCommandConfig(ctx);
};
