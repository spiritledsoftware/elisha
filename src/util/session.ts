import type {
  BadRequestError,
  Message,
  NotFoundError,
  Part,
  Session,
} from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { PluginContext } from '~/context';
import type { PartInput } from './types';

const MAX_POLL_INTERVAL_MS = 2000;
const BACKOFF_MULTIPLIER = 1.2;
const POLL_INTERVAL_MS = 200;
const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

export const getChildSessions = async (
  sessionID: string,
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
  const childrenResult = await client.session.children({
    sessionID,
    directory,
  });
  if (childrenResult.error) return { error: childrenResult.error };

  return { data: childrenResult.data };
};

export const formatChildSessionList = async (
  sessionID: string,
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
  const { data: children, error } = await getChildSessions(sessionID);
  if (error) return { error };
  // Format task IDs as a list
  const taskList = children
    .map((child) => `- \`${child.id}\`: ${child.title}`)
    .join('\n');

  return { data: taskList };
};

export const isSessionComplete = async (
  sessionID: string,
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

  const messagesResult = await client.session.messages({
    sessionID,
    directory,
  });
  if (messagesResult.error) {
    return { error: messagesResult.error };
  }

  // Get the latest message
  const lastestMessage = messagesResult.data
    // Sort by creation time descending
    .sort((a, b) => b.info.time.created - a.info.time.created)
    .at(0);
  if (!lastestMessage || lastestMessage.info.role !== 'assistant') {
    return { data: false };
  }

  const sessionStatusResult = await client.session.status({
    directory,
  });
  if (sessionStatusResult.error) {
    return { error: sessionStatusResult.error };
  }

  const sessionStatus = sessionStatusResult.data[sessionID];
  if (sessionStatus?.type === 'idle' || sessionStatus?.type === undefined) {
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
    const completedResult = await isSessionComplete(sessionID);
    if (completedResult.error) {
      return { error: completedResult.error };
    }
    if (completedResult.data) {
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

export const formatMessageParts = (parts: Array<Part>, info: Message) => {
  const result: Array<PartInput> = [];
  for (const part of parts) {
    if (part.type === 'text') {
      // NOTE: Strip the ID because OpenCode sorts by ID
      const { id: _id, text, ...rest } = part;
      result.push({
        ...rest,
        text: `**${
          info.role === 'assistant' ? info.agent : 'Prompt'
        }:**\n${text}\n\n`,
        synthetic: true,
      });
    }
    // Need to handle others later
  }
  return result;
};

export const fetchSessionOutput = async (
  sessionID: string,
): Promise<
  | {
      data: {
        info: Message;
        parts: Array<PartInput>;
      };
      error?: undefined;
    }
  | {
      data?: undefined;
      error: BadRequestError | NotFoundError;
    }
> => {
  const { client, directory } = PluginContext.use();

  const messagesResult = await client.session.messages({
    sessionID,
    directory,
  });
  if (messagesResult.error) return { error: messagesResult.error };

  // Sort messages by creation time ascending
  let messages = messagesResult.data.sort(
    (a, b) => a.info.time.created - b.info.time.created,
  );
  // Only return messages from the last user prompt onwards
  messages = messages.slice(
    messages.findLastIndex((m) => m.info.role === 'user') + 1,
  );

  const result = messages.reduce(
    (acc, message) => {
      acc.parts.push(...formatMessageParts(message.parts, message.info));
      acc.info = defu(acc.info, message.info) as Message;
      return acc;
    },
    {
      info: { role: 'user' } as Message,
      parts: [
        {
          type: 'text',
          text: `**Task(${sessionID}) output:**\n\n`,
          synthetic: true,
        },
      ] as Array<PartInput>,
    },
  );

  return { data: result };
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
      sessionID,
      directory,
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
