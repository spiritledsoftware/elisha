import { elishaCommands } from '.';

export const setupCommandConfig = async () => {
  for (const command of elishaCommands) {
    await command.setup();
  }
};
