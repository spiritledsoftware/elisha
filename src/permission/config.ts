import { ConfigContext } from '~/context';
import { cleanupPermissions, getGlobalPermissions } from './utils';

export const setupPermissionConfig = async () => {
  const config = ConfigContext.use();
  config.permission = cleanupPermissions(getGlobalPermissions());
};
