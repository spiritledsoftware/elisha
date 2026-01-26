import type { Session } from '@opencode-ai/sdk';
import type { BadRequestError, NotFoundError } from '@opencode-ai/sdk/v2';
import { PluginContext } from '~/context';

const MAX_POLL_INTERVAL_MS = 5000;
const BACKOFF_MULTIPLIER = 1.5;
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

export const getChildSessions = async (
  id: string,
): Promise<
  | {
      data: Session[];
      error?: undefined;
    }
  | {
      data?: undefined;
      error: BadRequestError | NotFoundError;
    }
> => {
  const { client, directory } = PluginContext.use();
  // Get child sessions (tasks) for this session
  const { data: children, error } = await client.session.children({
    path: { id: id },
    query: { directory },
  });
  if (error) return { error };

  return { data: children };
};

export const formatChildSessionList = async (
  id: string,
): Promise<
  | {
      data: string;
      error?: undefined;
    }
  | {
      data?: undefined;
      error: BadRequestError | NotFoundError;
    }
> => {
  const { data: children, error } = await getChildSessions(id);
  if (error) return { error };
  // Format task IDs as a list
  const taskList = children
    .map((child) => `- \`${child.id}\` - ${child.title || 'Untitled task'}`)
    .join('\n');

  return { data: taskList };
};

export const isSessionComplete = async (
  id: string,
): Promise<
  | {
      data: boolean;
      error?: undefined;
    }
  | {
      data?: undefined;
      error: BadRequestError | NotFoundError;
    }
> => {
  const { client, directory } = PluginContext.use();

  const [sessionStatusResult, sessionMessagesResult] = await Promise.all([
    client.session.status({
      query: { directory },
    }),
    client.session.messages({
      path: { id },
      query: { directory, limit: 1 },
    }),
  ]);
  if (sessionStatusResult.error) {
    return { error: sessionStatusResult.error };
  }
  if (sessionMessagesResult.error) {
    return { error: sessionMessagesResult.error };
  }

  // No messages yet, session is still busy
  if (sessionMessagesResult.data.length === 0) {
    return { data: false };
  }

  // Session is idle (completed)
  if (sessionStatusResult.data[id]?.type === 'idle') {
    return { data: true };
  }

  return { data: false };
};

export const waitForSession = async (
  sessionID: string,
  timeoutMs = TIMEOUT_MS,
): Promise<
  | {
      data: boolean;
      error?: undefined;
    }
  | {
      data?: undefined;
      error: BadRequestError | NotFoundError;
    }
> => {
  const effectiveTimeout = Math.max(timeoutMs, 1000);
  const startTime = Date.now();
  let pollInterval = POLL_INTERVAL_MS;
  while (Date.now() - startTime < effectiveTimeout) {
    const { data: complete, error } = await isSessionComplete(sessionID);
    if (error) return { error };

    if (complete) {
      return { data: true };
    }
    await Bun.sleep(pollInterval);
    pollInterval = Math.min(
      pollInterval * BACKOFF_MULTIPLIER,
      MAX_POLL_INTERVAL_MS,
    );
  }

  return { data: false };
};

export const fetchSessionText = async (
  id: string,
): Promise<
  | {
      data: string;
      error?: undefined;
    }
  | {
      data?: undefined;
      error: BadRequestError | NotFoundError;
    }
> => {
  const { client, directory } = PluginContext.use();

  const { data: messages, error } = await client.session.messages({
    path: { id: id },
    query: { directory },
  });
  if (error) return { error };

  // Extract text content from the message parts
  return {
    data:
      messages
        .filter((m) => m.info.role === 'assistant')
        .flatMap((m) => m.parts)
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n') || '(No text content in response)',
  };
};

export async function getSessionAgentAndModel(sessionID: string): Promise<
  | {
      data: {
        model:
          | {
              providerID: string;
              modelID: string;
            }
          | undefined;
        agent: string | undefined;
      };
      error?: undefined;
    }
  | {
      data?: undefined;
      error: BadRequestError | NotFoundError;
    }
> {
  const { client, directory } = PluginContext.use();

  return await client.session
    .messages({
      path: { id: sessionID },
      query: { directory, limit: 50 },
    })
    .then(({ data, error }) => {
      if (error) return { error };

      for (const msg of data) {
        if ('model' in msg.info && msg.info.model) {
          return {
            data: {
              model: msg.info.model,
              agent: msg.info.agent,
            },
            error: undefined,
          };
        }
      }

      return { data: { model: undefined, agent: undefined } };
    });
}
