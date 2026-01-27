import { describe, expect, it, mock, spyOn } from 'bun:test';
import type { Hooks } from '@opencode-ai/plugin';
import { PluginContext } from '~/context';
import { aggregateHooks } from '~/hook/util';
import * as utilIndex from '~/util';
import { createMockPluginCtx } from '../test-setup';

describe('aggregateHooks', () => {
  describe('chat.params', () => {
    it('calls all hooks from all hook sets', async () => {
      const ctx = createMockPluginCtx();
      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() => Promise.resolve());
        const hook2 = mock(() => Promise.resolve());
        const hook3 = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [
          { 'chat.params': hook1 },
          { 'chat.params': hook2 },
          { 'chat.params': hook3 },
        ];

        const aggregated = aggregateHooks(hookSets);
        await aggregated['chat.params']?.({} as never, {} as never);

        expect(hook1).toHaveBeenCalledTimes(1);
        expect(hook2).toHaveBeenCalledTimes(1);
        expect(hook3).toHaveBeenCalledTimes(1);
      });
    });

    it('runs hooks concurrently', async () => {
      const ctx = createMockPluginCtx();
      await PluginContext.provide(ctx, async () => {
        const executionOrder: number[] = [];

        const hook1 = mock(async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          executionOrder.push(1);
        });
        const hook2 = mock(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executionOrder.push(2);
        });
        const hook3 = mock(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          executionOrder.push(3);
        });

        const hookSets: Hooks[] = [
          { 'chat.params': hook1 },
          { 'chat.params': hook2 },
          { 'chat.params': hook3 },
        ];

        const aggregated = aggregateHooks(hookSets);
        await aggregated['chat.params']?.({} as never, {} as never);

        // If concurrent, hook2 (10ms) finishes first, then hook3 (20ms), then hook1 (30ms)
        expect(executionOrder).toEqual([2, 3, 1]);
      });
    });

    it('continues executing other hooks when one fails', async () => {
      const logSpy = spyOn(utilIndex, 'log').mockResolvedValue(undefined);
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() => Promise.resolve());
        const hook2 = mock(() => Promise.reject(new Error('Hook 2 failed')));
        const hook3 = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [
          { 'chat.params': hook1 },
          { 'chat.params': hook2 },
          { 'chat.params': hook3 },
        ];

        const aggregated = aggregateHooks(hookSets);
        await aggregated['chat.params']?.({} as never, {} as never);

        // All hooks should have been called despite hook2 failing
        expect(hook1).toHaveBeenCalledTimes(1);
        expect(hook2).toHaveBeenCalledTimes(1);
        expect(hook3).toHaveBeenCalledTimes(1);
      });

      logSpy.mockRestore();
    });

    it('logs errors for failed hooks', async () => {
      const logSpy = spyOn(utilIndex, 'log').mockResolvedValue(undefined);
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const errorMessage = 'Test hook failure';
        const hook1 = mock(() => Promise.reject(new Error(errorMessage)));

        const hookSets: Hooks[] = [{ 'chat.params': hook1 }];

        const aggregated = aggregateHooks(hookSets);
        await aggregated['chat.params']?.({} as never, {} as never);

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            level: 'error',
            message: expect.stringContaining(errorMessage),
          }),
        );
      });

      logSpy.mockRestore();
    });
  });

  describe('event', () => {
    it('calls all event hooks from all hook sets', async () => {
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() => Promise.resolve());
        const hook2 = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [{ event: hook1 }, { event: hook2 }];

        const aggregated = aggregateHooks(hookSets);
        await aggregated.event?.({} as never);

        expect(hook1).toHaveBeenCalledTimes(1);
        expect(hook2).toHaveBeenCalledTimes(1);
      });
    });

    it('continues when one event hook fails', async () => {
      const logSpy = spyOn(utilIndex, 'log').mockResolvedValue(undefined);
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() =>
          Promise.reject(new Error('Event hook failed')),
        );
        const hook2 = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [{ event: hook1 }, { event: hook2 }];

        const aggregated = aggregateHooks(hookSets);
        await aggregated.event?.({} as never);

        expect(hook1).toHaveBeenCalledTimes(1);
        expect(hook2).toHaveBeenCalledTimes(1);
      });

      logSpy.mockRestore();
    });
  });

  describe('tool.execute.before', () => {
    it('calls all tool.execute.before hooks from all hook sets', async () => {
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() => Promise.resolve());
        const hook2 = mock(() => Promise.resolve());
        const hook3 = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [
          { 'tool.execute.before': hook1 },
          { 'tool.execute.before': hook2 },
          { 'tool.execute.before': hook3 },
        ];

        const aggregated = aggregateHooks(hookSets);
        await aggregated['tool.execute.before']?.({} as never, {} as never);

        expect(hook1).toHaveBeenCalledTimes(1);
        expect(hook2).toHaveBeenCalledTimes(1);
        expect(hook3).toHaveBeenCalledTimes(1);
      });
    });

    it('continues when one tool hook fails', async () => {
      const logSpy = spyOn(utilIndex, 'log').mockResolvedValue(undefined);
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() => Promise.resolve());
        const hook2 = mock(() => Promise.reject(new Error('Tool hook failed')));
        const hook3 = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [
          { 'tool.execute.before': hook1 },
          { 'tool.execute.before': hook2 },
          { 'tool.execute.before': hook3 },
        ];

        const aggregated = aggregateHooks(hookSets);
        await aggregated['tool.execute.before']?.({} as never, {} as never);

        expect(hook1).toHaveBeenCalledTimes(1);
        expect(hook2).toHaveBeenCalledTimes(1);
        expect(hook3).toHaveBeenCalledTimes(1);
      });

      logSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles empty hook sets gracefully', async () => {
      const ctx = createMockPluginCtx();

      PluginContext.provide(ctx, () => {
        const hookSets: Hooks[] = [];

        const aggregated = aggregateHooks(hookSets);

        // Should not throw
        expect(
          aggregated['chat.params']?.({} as never, {} as never),
        ).resolves.toBeUndefined();
        expect(aggregated.event?.({} as never)).resolves.toBeUndefined();
        expect(
          aggregated['tool.execute.before']?.({} as never, {} as never),
        ).resolves.toBeUndefined();
      });
    });

    it('handles hooks that are undefined', async () => {
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() => Promise.resolve());

        // Hook sets where some don't have the hook defined
        const hookSets: Hooks[] = [
          { 'chat.params': hook1 },
          {}, // No chat.params hook
          { event: mock(() => Promise.resolve()) }, // Different hook
        ];

        const aggregated = aggregateHooks(hookSets);

        // Should not throw and should call the defined hook
        expect(
          aggregated['chat.params']?.({} as never, {} as never),
        ).resolves.toBeUndefined();
        expect(hook1).toHaveBeenCalledTimes(1);
      });
    });

    it('handles mixed defined and undefined hooks across sets', async () => {
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const chatHook1 = mock(() => Promise.resolve());
        const chatHook2 = mock(() => Promise.resolve());
        const eventHook = mock(() => Promise.resolve());
        const toolHook = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [
          { 'chat.params': chatHook1, event: eventHook },
          { 'chat.params': chatHook2 },
          { 'tool.execute.before': toolHook },
        ];

        const aggregated = aggregateHooks(hookSets);

        await aggregated['chat.params']?.({} as never, {} as never);
        await aggregated.event?.({} as never);
        await aggregated['tool.execute.before']?.({} as never, {} as never);

        expect(chatHook1).toHaveBeenCalledTimes(1);
        expect(chatHook2).toHaveBeenCalledTimes(1);
        expect(eventHook).toHaveBeenCalledTimes(1);
        expect(toolHook).toHaveBeenCalledTimes(1);
      });
    });

    it('logs multiple errors when multiple hooks fail', async () => {
      const logSpy = spyOn(utilIndex, 'log').mockResolvedValue(undefined);
      const ctx = createMockPluginCtx();

      await PluginContext.provide(ctx, async () => {
        const hook1 = mock(() => Promise.reject(new Error('Error 1')));
        const hook2 = mock(() => Promise.reject(new Error('Error 2')));
        const hook3 = mock(() => Promise.resolve());

        const hookSets: Hooks[] = [
          { 'chat.params': hook1 },
          { 'chat.params': hook2 },
          { 'chat.params': hook3 },
        ];

        const aggregated = aggregateHooks(hookSets);
        await aggregated['chat.params']?.({} as never, {} as never);

        expect(logSpy).toHaveBeenCalledTimes(2);
      });

      logSpy.mockRestore();
    });
  });
});
