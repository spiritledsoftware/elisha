import type { Hooks } from './types';

export type ElishaHookSetOptions = {
  id: string;
  hooks: () => Hooks | Promise<Hooks>;
};

export type ElishaHookSet = Omit<ElishaHookSetOptions, 'hooks'> & {
  setup: () => Promise<Hooks>;
};

export const defineHookSet = ({
  hooks,
  ...options
}: ElishaHookSetOptions): ElishaHookSet => {
  return {
    ...options,
    async setup() {
      return await hooks();
    },
  };
};
