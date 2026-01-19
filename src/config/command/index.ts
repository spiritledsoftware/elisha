import type { ElishaConfigContext } from '../types';
import { setupInitDeepCommandConfig } from './init-deep';

export const setupCommandConfig = (ctx: ElishaConfigContext) => {
  setupInitDeepCommandConfig(ctx);
};

export type * from './types';
