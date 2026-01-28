import { elishaCommands } from '~/features/commands';

export const setupCommandConfig = async () => {
  await Promise.all(elishaCommands.map(async (command) => await command.setup()));
};
