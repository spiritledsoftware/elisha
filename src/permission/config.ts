import { ConfigContext } from '~/context';
import { cleanupPermissions, getGlobalPermissions } from './util';

export function setupPermissionConfig() {
  const config = ConfigContext.use();
  config.permission = cleanupPermissions(getGlobalPermissions());
}
