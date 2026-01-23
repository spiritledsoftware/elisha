import { initDeepCommand } from '~/features/commands/init-deep';

const elishaCommands = [initDeepCommand];

export const setupCommandConfig = async () => {
  for (const command of elishaCommands) {
    await command.setup();
  }
};
