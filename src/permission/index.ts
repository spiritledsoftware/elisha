import type { ElishaConfigContext } from '../types.ts';
import { cleanupPermissions, getGlobalPermissions } from './defaults.ts';

// Re-export from submodules
export * from './agent.ts';
export * from './defaults.ts';

export const setupPermissionConfig = (ctx: ElishaConfigContext) => {
  ctx.config.permission = cleanupPermissions(getGlobalPermissions(ctx), ctx);
};
