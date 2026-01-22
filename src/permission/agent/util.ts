import type { ElishaConfigContext } from '~/types.ts';
import { hasPermission } from '../util.ts';

export const getAgentPermissions = (name: string, ctx: ElishaConfigContext) => {
  return ctx.config.agent?.[name]?.permission ?? {};
};

export const agentHasPermission = (
  permissionPattern: string,
  agentName: string,
  ctx: ElishaConfigContext,
) => {
  const permissions = getAgentPermissions(agentName, ctx);
  if (!permissions) {
    return true;
  }
  if (typeof permissions === 'string') {
    return permissions !== 'deny';
  }
  const exactPermission = permissions[permissionPattern];
  if (exactPermission) {
    return hasPermission(exactPermission);
  }

  const basePattern = permissionPattern.replace(/\*$/, '');
  for (const [key, value] of Object.entries(permissions)) {
    const baseKey = key.replace(/\*$/, '');
    if (basePattern.startsWith(baseKey)) {
      return hasPermission(value);
    }
  }

  return true;
};
