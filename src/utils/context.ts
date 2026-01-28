import { AsyncLocalStorage } from 'node:async_hooks';

export class ContextNotFoundError extends Error {
  constructor(public override readonly name: string) {
    super(`Context "${name}" not found`);
  }
}

export function createContext<T>(name: string) {
  const storage = new AsyncLocalStorage<T>();
  return {
    use() {
      const store = storage.getStore();
      if (!store) {
        throw new ContextNotFoundError(name);
      }
      return store;
    },
    provide<R>(value: T, fn: () => R) {
      return storage.run(value, fn);
    },
    capture() {
      const value = this.use();
      return {
        run: <R>(fn: () => R): R => storage.run(value, fn),
        value,
      };
    },
  };
}
