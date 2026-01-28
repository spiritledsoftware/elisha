import { PluginContext } from '~/context';
import { defineHookSet } from '~/hook';
import { log } from '~/utils';

/**
 * Prune orphaned worktrees on plugin initialization.
 * This cleans up stale worktree metadata from crashed sessions.
 */
async function pruneOrphanedWorktrees(): Promise<void> {
  const { $, directory } = PluginContext.use();

  try {
    // Run git worktree prune to clean stale metadata
    await $`git worktree prune`.cwd(directory).quiet();
    log({
      level: 'info',
      message: 'Pruned stale worktree metadata',
    });
  } catch (err) {
    log({
      level: 'warn',
      message: `Failed to prune worktree metadata: ${err}`,
    });
  }
}

export const worktreeHooks = defineHookSet({
  id: 'worktree-hooks',
  hooks: () => {
    // Run orphan cleanup on initialization
    pruneOrphanedWorktrees().catch((err) => {
      log({
        level: 'warn',
        message: `Error during worktree orphan cleanup: ${err}`,
      });
    });

    // No event handlers needed - cleanup is manual via protocol
    return {};
  },
});
