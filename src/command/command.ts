import defu from 'defu';
import { ConfigContext } from '~/context';
import type { CommandConfig } from './types';

export type ElishaCommandOptions = {
  id: string;
  config: CommandConfig | ((self: ElishaCommand) => CommandConfig | Promise<CommandConfig>);
};

export type ElishaCommand = Omit<ElishaCommandOptions, 'config'> & {
  setup: () => Promise<void>;
};

export const defineCommand = ({ config: commandConfig, ...input }: ElishaCommandOptions) => {
  let self: ElishaCommand;

  const command: ElishaCommand = {
    ...input,
    setup: async () => {
      if (typeof commandConfig === 'function') {
        commandConfig = await commandConfig(self);
      }

      const config = ConfigContext.use();

      config.command ??= {};
      config.command[self.id] = defu(config.command?.[self.id] ?? {}, commandConfig);
    },
  };

  self = command;
  return self;
};
