import type {
  ConfigContext as ConfigContextType,
  PluginContext as PluginContextType,
} from './types';
import { createContext } from './util/context';

export const ConfigContext = createContext<ConfigContextType>(
  'ElishaConfigContext',
);
export const PluginContext = createContext<PluginContextType>(
  'ElishaPluginContext',
);
