import { elishaCommands } from '~/features/commands';

export const setupCommandConfig = async () => {
  for (const command of elishaCommands) {
    await command.setup();
  }
};
