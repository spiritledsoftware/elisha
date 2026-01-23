import type { PluginInput } from '@opencode-ai/plugin';
import type { Config } from '@opencode-ai/sdk/v2';
import { createContext } from './util/context';

export const ConfigContext = createContext<Config>('ElishaConfigContext');
export const PluginContext = createContext<PluginInput>('ElishaPluginContext');
