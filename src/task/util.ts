import type { PluginInput } from '@opencode-ai/plugin';
import type { Session } from '@opencode-ai/sdk';

const MAX_POLL_INTERVAL_MS = 5000;
const BACKOFF_MULTIPLIER = 1.5;
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

export const getTasks = async (
  sessionId: string,
  ctx: PluginInput,
): Promise<Session[]> => {
  // Get child sessions (tasks) for this session
  const { data: children } = await ctx.client.session.children({
    path: { id: sessionId },
    query: { directory: ctx.directory },
  });

  return children || [];
};

export const getTaskList = async (
  sessionId: string,
  ctx: PluginInput,
): Promise<string | null> => {
  const children = await getTasks(sessionId, ctx);
  // Format task IDs as a list
  const taskList = children
    .map((child) => `- \`${child.id}\` - ${child.title || 'Untitled task'}`)
    .join('\n');

  return taskList;
};

export const isTaskComplete = async (
  id: string,
  ctx: PluginInput,
): Promise<boolean> => {
  try {
    const [sessionStatus, sessionMessages] = await Promise.all([
      ctx.client.session
        .status({
          query: { directory: ctx.directory },
        })
        .then((r) => r.data?.[id]),
      ctx.client.session
        .messages({
          path: { id },
          query: { directory: ctx.directory, limit: 1 },
        })
        .then((r) => r.data),
    ]);

    // Session not found in status map - may have completed and been cleaned up
    if (!sessionStatus) {
      // Confirm by checking if session has messages
      const { data: messages } = await ctx.client.session.messages({
        path: { id },
        query: { limit: 1 },
      });
      // If session has messages and no status, likely completed
      return !!(messages && messages.length > 0);
    }

    // No messages yet, session is still busy
    if (!sessionMessages || sessionMessages.length === 0) {
      return false;
    }

    // Session is idle (completed)
    if (sessionStatus.type === 'idle') {
      return true;
    }

    return false;
  } catch {
    // On transient API errors, return false to continue polling
    return false;
  }
};

export const waitForTask = async (
  id: string,
  timeoutMs = TIMEOUT_MS,
  ctx: PluginInput,
): Promise<boolean> => {
  const effectiveTimeout = Math.max(timeoutMs, 1000);
  const startTime = Date.now();
  let pollInterval = POLL_INTERVAL_MS;
  while (Date.now() - startTime < effectiveTimeout) {
    const complete = await isTaskComplete(id, ctx);
    if (complete) {
      return true;
    }
    await Bun.sleep(pollInterval);
    pollInterval = Math.min(
      pollInterval * BACKOFF_MULTIPLIER,
      MAX_POLL_INTERVAL_MS,
    );
  }

  return false;
};

export const fetchTaskText = async (
  id: string,
  ctx: PluginInput,
): Promise<string> => {
  const { data: messages } = await ctx.client.session.messages({
    path: { id: id },
    query: { limit: 200 },
  });
  if (!messages) {
    throw new Error('No messages were found.');
  }

  // Extract text content from the message parts
  return (
    messages
      .flatMap((message) => message.parts)
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n') || '(No text content in response)'
  );
};
