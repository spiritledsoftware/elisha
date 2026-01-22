import type { PermissionConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import type { ElishaConfigContext } from '../../types.ts';
import { getGlobalPermissions } from '../index.ts';
import { cleanupPermissions } from '../util.ts';

export const setupAgentPermissions = (
  name: string,
  permissions: PermissionConfig,
  ctx: ElishaConfigContext,
) => {
  return cleanupPermissions(
    defu(
      ctx.config.agent?.[name]?.permission ?? {},
      permissions,
      getGlobalPermissions(ctx),
    ),
    ctx,
  );
};
