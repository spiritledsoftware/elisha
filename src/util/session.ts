import type { Session } from '@opencode-ai/sdk';
import { PluginContext } from '~/context';

const MAX_POLL_INTERVAL_MS = 5000;
const BACKOFF_MULTIPLIER = 1.5;
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

export const getChildSessions = async (id: string): Promise<Session[]> => {
  const { client, directory } = PluginContext.use();
  // Get child sessions (tasks) for this session
  const { data: children } = await client.session.children({
    path: { id: id },
    query: { directory },
  });

  return children || [];
};

export const formatChildSessionList = async (
  id: string,
): Promise<string | null> => {
  const children = await getChildSessions(id);
  // Format task IDs as a list
  const taskList = children
    .map((child) => `- \`${child.id}\` - ${child.title || 'Untitled task'}`)
    .join('\n');

  return taskList;
};

export const isSessionComplete = async (id: string): Promise<boolean> => {
  const { client, directory } = PluginContext.use();

  try {
    const [sessionStatus, sessionMessages] = await Promise.all([
      client.session
        .status({
          query: { directory },
        })
        .then((r) => r.data?.[id]),
      client.session
        .messages({
          path: { id },
          query: { directory, limit: 1 },
        })
        .then((r) => r.data),
    ]);

    // Session not found in status map - may have completed and been cleaned up
    if (!sessionStatus) {
      // Confirm by checking if session has messages
      const { data: messages } = await client.session.messages({
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

export const waitForSession = async (
  sessionID: string,
  timeoutMs = TIMEOUT_MS,
): Promise<boolean> => {
  const effectiveTimeout = Math.max(timeoutMs, 1000);
  const startTime = Date.now();
  let pollInterval = POLL_INTERVAL_MS;
  while (Date.now() - startTime < effectiveTimeout) {
    const complete = await isSessionComplete(sessionID);
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

export const fetchSessionText = async (id: string): Promise<string> => {
  const { client, directory } = PluginContext.use();

  const { data: messages } = await client.session.messages({
    path: { id: id },
    query: { directory },
  });
  if (!messages) {
    throw new Error('No messages were found.');
  }

  // Extract text content from the message parts
  return (
    messages
      .filter((m) => m.info.role === 'assistant')
      .flatMap((m) => m.parts)
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n') || '(No text content in response)'
  );
};

export async function getSessionAgentAndModel(sessionID: string) {
  const { client, directory } = PluginContext.use();

  return await client.session
    .messages({
      path: { id: sessionID },
      query: { directory, limit: 50 },
    })
    .then(({ data = [] }) => {
      for (const msg of data) {
        if ('model' in msg.info && msg.info.model) {
          return { model: msg.info.model, agent: msg.info.agent };
        }
      }
      return { model: undefined, agent: undefined };
    });
}
