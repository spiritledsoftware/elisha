import { homedir } from 'node:os';
import path from 'node:path';
import type { PluginInput } from '@opencode-ai/plugin';
import type { LogLevel } from '@opencode-ai/sdk/v2';

// Re-export from submodules
export * from '../types.ts';
export * from './hooks.ts';

export const getCacheDir = () => {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA;
    const base = localAppData || path.join(homedir(), 'AppData', 'Local');
    return path.join(base, 'Elisha', 'Cache');
  }
  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  const base = xdgCacheHome || path.join(homedir(), '.cache');
  return path.join(base, 'elisha');
};

export const getDataDir = () => {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA;
    const base = localAppData || path.join(homedir(), 'AppData', 'Local');
    return path.join(base, 'Elisha', 'Data');
  }
  const xdgDataHome = process.env.XDG_DATA_HOME;
  const base = xdgDataHome || path.join(homedir(), '.local', 'share');
  return path.join(base, 'elisha');
};

export const log = async (
  options: {
    level?: Lowercase<LogLevel>;
    message: string;
    meta?: { [key: string]: unknown };
  },
  ctx: PluginInput,
) => {
  const { level = 'info', message, meta: extra } = options;
  await ctx.client.app.log({
    query: { directory: ctx.directory },
    body: {
      service: 'elisha',
      level,
      message,
      extra,
    },
  });
};
