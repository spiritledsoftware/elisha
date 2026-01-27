import type {
  BadRequestError,
  Message,
  NotFoundError,
  Part,
  Session,
} from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { PluginContext } from '~/context';
import type { Broadcast } from '~/features/tools/tasks/types';
import { Prompt } from './prompt';
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

/**
 * Gets only active (running) child sessions for a given session.
 * Filters out sessions that are idle or have undefined status.
 * @param sessionID - The parent session ID
 * @returns Array of active child sessions
 */
export const getActiveChildSessions = async (
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

  // Get all child sessions
  const childrenResult = await getChildSessions(sessionID);
  if (childrenResult.error) return { error: childrenResult.error };

  // Get session statuses
  const statusResult = await client.session.status({ directory });
  if (statusResult.error) return { error: statusResult.error };

  // Filter to only active sessions (not idle and not undefined)
  const activeSessions = childrenResult.data.filter((child) => {
    const status = statusResult.data[child.id];
    return status?.type !== undefined && status.type !== 'idle';
  });

  return { data: activeSessions };
};

export type NoParentError = {
  data: {
    code: string;
    message: string;
  };
};

export const getSiblingSessions = async (
  sessionID: string,
): Promise<
  | {
      data: { siblings: Session[]; parentID: string };
      error?: undefined;
    }
  | {
      data?: undefined;
      error: NoParentError | BadRequestError | NotFoundError;
    }
> => {
  const { client, directory } = PluginContext.use();

  // Get current session to find parent
  const sessionResult = await client.session.get({ sessionID, directory });
  if (sessionResult.error) return { error: sessionResult.error };

  const { parentID } = sessionResult.data;
  if (!parentID) {
    return {
      error: { data: { code: 'NO_PARENT', message: 'Session has no parent' } },
    };
  }

  // Get siblings (children of parent)
  const siblingsResult = await client.session.children({
    sessionID: parentID,
    directory,
  });
  if (siblingsResult.error) return { error: siblingsResult.error };

  // Filter out self
  const siblings = siblingsResult.data.filter((s) => s.id !== sessionID);

  return { data: { siblings, parentID } };
};

/**
 * Gets all related sessions (children + siblings) for validation purposes.
 * Used by task_output and task_send_message to validate task IDs.
 * @param sessionID - The current session ID
 * @returns Combined array of child and sibling sessions
 */
export const getRelatedSessions = async (
  sessionID: string,
): Promise<
  | {
      data: Session[];
      error?: undefined;
    }
  | {
      data?: undefined;
      error:
        | BadRequestError
        | NotFoundError
        | { data: { code: string; message: string } };
    }
> => {
  // Get children
  const childrenResult = await getChildSessions(sessionID);
  if (childrenResult.error) return { error: childrenResult.error };

  // Get siblings (may fail if no parent - that's ok, just use children)
  const siblingsResult = await getSiblingSessions(sessionID);

  // Combine children and siblings (siblings may be empty if no parent)
  const children = childrenResult.data;
  const siblings = siblingsResult.data?.siblings ?? [];

  // Dedupe by session ID (shouldn't have duplicates, but be safe)
  const sessionMap = new Map<string, Session>();
  for (const session of [...children, ...siblings]) {
    sessionMap.set(session.id, session);
  }

  return { data: Array.from(sessionMap.values()) };
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

export const formatSiblingSessionList = async (
  sessionID: string,
): Promise<
  | {
      data: string;
      error?: undefined;
    }
  | {
      data?: undefined;
      error: NoParentError | BadRequestError | NotFoundError;
    }
> => {
  const { data, error } = await getSiblingSessions(sessionID);
  if (error) return { error };
  // Format task IDs as a list
  const taskList = data.siblings
    .map((s) => `- \`${s.id}\`: ${s.title}`)
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

  // If there are 0 or 1 messages, session is not complete
  if (messagesResult.data.length <= 1) {
    return { data: false };
  }

  // Get the latest message
  const latestMessage = messagesResult.data.sort(
    // Sort by creation time descending
    (a, b) => b.info.time.created - a.info.time.created,
  )[0];
  if (!latestMessage) {
    return { data: false };
  }

  const isAssistantOrSynthetic =
    latestMessage.info.role === 'assistant' ||
    latestMessage.parts.some((p) => p.type === 'text' && p.synthetic !== false);
  if (!isAssistantOrSynthetic) {
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
  // NOTE: Strip the ID because OpenCode sorts by ID
  for (const { id: _id, ...part } of parts) {
    if (part.type === 'reasoning') {
      const { text, ...rest } = part;
      result.push({
        ...rest,
        type: 'text',
        text: `<thinking>\n${text}\n</thinking>`,
        synthetic: true,
      });
    }
    if (part.type === 'text') {
      result.push({
        ...part,
        synthetic: true,
      });
    }
    if (part.type === 'tool') {
      result.push({
        type: 'text',
        text: Prompt.template`
          <tool_call>
            Name: ${part.tool}
            Input: ${JSON.stringify(part.state.input)}
          </tool_call>
        `,
        synthetic: true,
      });
    }
    // Need to handle others later
  }
  if (result.length > 0) {
    result.unshift({
      type: 'text',
      text: `**${info.role === 'assistant' ? info.agent : 'Prompt'}:**\n---\n`,
      synthetic: true,
    });
    result.push({
      type: 'text',
      text: `\n---\n`,
      synthetic: true,
    });
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
  // Only return messages from the last non-synthetic user prompt onwards
  messages = messages.slice(
    messages.findLastIndex(
      (m) =>
        m.info.role === 'user' &&
        m.parts.some((p) => p.type === 'text' && p.synthetic !== true),
    ),
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
          text: `# Task(${sessionID}) output:\n`,
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

/**
 * Formats a broadcast message as XML for injection into sibling sessions.
 * @param agentName - The agent sending the broadcast (e.g., "Caleb (explorer)")
 * @param taskId - The session ID of the sending task
 * @param category - The broadcast category
 * @param message - The broadcast content (will be trimmed)
 * @returns XML-formatted broadcast string
 */
export const formatBroadcastMessage = (
  agentName: string,
  taskId: string,
  category: string,
  message: string,
): string => {
  const timestamp = new Date().toISOString();
  return `<sibling_broadcast from="${agentName}" task_id="${taskId}" category="${category}" timestamp="${timestamp}">
${message.trim()}
</sibling_broadcast>`;
};

/**
 * Parses broadcast messages from session messages.
 * Extracts <sibling_broadcast> elements and returns structured data.
 * @param messages - Array of session messages to parse
 * @returns Array of Broadcast objects sorted by timestamp (newest first)
 */
export const parseBroadcasts = (
  messages: Array<{ info: Message; parts: Array<Part> }>,
): Broadcast[] => {
  const broadcasts: Broadcast[] = [];
  const regex =
    /<sibling_broadcast from="([^"]+)" task_id="([^"]+)" category="([^"]+)" timestamp="([^"]+)">([\s\S]*?)<\/sibling_broadcast>/g;

  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === 'text') {
        const matches = part.text.matchAll(regex);
        for (const match of matches) {
          // Skip if any capture group is missing (malformed broadcast)
          if (!match[1] || !match[2] || !match[3] || !match[4] || !match[5]) {
            continue;
          }
          broadcasts.push({
            from: match[1],
            task_id: match[2],
            category: match[3] as Broadcast['category'],
            timestamp: match[4],
            message: match[5].trim(),
          });
        }
      }
    }
  }

  // Sort by timestamp descending (newest first)
  return broadcasts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
};

/**
 * Gets all broadcasts from child sessions.
 * Used by orchestrator to read what children are broadcasting to each other.
 * @param sessionID - The parent session ID
 * @returns Array of Broadcast objects with source: 'child', sorted by timestamp (newest first)
 */
export const getChildSessionBroadcasts = async (
  sessionID: string,
): Promise<Broadcast[]> => {
  const { client, directory } = PluginContext.use();

  // Get all child sessions
  const childrenResult = await getChildSessions(sessionID);
  if (childrenResult.error) return [];

  const allBroadcasts: Broadcast[] = [];

  // For each child, get messages and parse broadcasts
  for (const child of childrenResult.data) {
    const messagesResult = await client.session.messages({
      sessionID: child.id,
      directory,
    });
    if (messagesResult.error) continue; // Skip failed children

    const broadcasts = parseBroadcasts(messagesResult.data);
    // Add source indicator
    allBroadcasts.push(
      ...broadcasts.map((b) => ({ ...b, source: 'child' as const })),
    );
  }

  // Sort by timestamp descending (newest first)
  return allBroadcasts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
};
