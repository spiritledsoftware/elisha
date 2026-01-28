# Spec: Sibling Task Communication

**Version**: 2.1
**Last Updated**: 2026-01-26T22:00:00Z
**Last Agent**: architect
**Status**: Draft
**Scope**: system

**Changes from 2.0**:

- Added `task_output` sibling support (FR-12, AC-9)
- Added `noReply` parameter to `task_send_message` for passive directed messages (FR-13, AC-10)
- Updated implementation notes for tool changes

**Changes from 1.0**:

- Added orchestrator participation (can broadcast TO children and READ broadcasts FROM children)
- Added sibling injection mechanism via hook for automatic sibling awareness
- Added `target` parameter to `task_broadcast` tool
- Added `source` parameter to `task_broadcasts_read` tool
- Updated permission model to include orchestrator
- Expanded `task_send_message` scope documentation for sibling messaging

## Executive Summary

This specification addresses the isolation problem in the Elisha agent swarm where sibling tasks cannot share discoveries. When the orchestrator delegates parallel tasks to specialists (e.g., Caleb exploring while Baruch implements), discoveries made by one task are invisible to siblings, causing redundant work and inconsistent context.

**Version 2.0** expands the scope to include:

1. **Orchestrator participation**: Orchestrator can broadcast to children and read broadcasts from children
2. **Automatic sibling awareness**: Hook-based injection of sibling task IDs into task context
3. **Flexible broadcast targeting**: Broadcast to siblings, children, or all
4. **Bidirectional communication**: Full parent-child-sibling communication matrix

## Problem Statement

### Current Behavior

```
Orchestrator (parent session)
├── Task A: Caleb (explorer) - discovers "config is at src/config.ts"
├── Task B: Baruch (executor) - needs config location, re-searches
└── Task C: Berean (researcher) - unaware of codebase discoveries
```

Each task is an isolated OpenCode session. Tasks can only communicate:

- **Up**: Results flow back to parent when task completes
- **Down**: Parent can send messages via `task_send_message`

There is no **lateral** communication between siblings, and siblings don't know each other's task IDs.

### Impact

1. **Redundant work**: Multiple agents search for the same information
2. **Inconsistent context**: Agents make decisions without sibling discoveries
3. **Wasted tokens**: Re-discovering known facts burns context window
4. **Slower workflows**: Sequential discovery instead of parallel learning
5. **No sibling awareness**: Tasks don't know their siblings exist

## Requirements

### Functional Requirements

1. **FR-1**: Agents MUST be able to broadcast discoveries to sibling tasks
2. **FR-2**: Broadcasts MUST persist in receiving session's message history
3. **FR-3**: System MUST work for both parallel (real-time) and sequential (historical) tasks
4. **FR-4**: System MUST prevent broadcast storms and infinite loops
5. **FR-5**: Completed tasks SHOULD receive broadcasts (for resurrection scenarios)
6. **FR-6**: Agents MUST be able to read broadcasts from siblings without triggering responses
7. **FR-7**: Orchestrator MUST be able to broadcast to all child tasks
8. **FR-8**: Orchestrator MUST be able to read broadcasts from child tasks
9. **FR-9**: Tasks MUST automatically receive sibling task IDs when created
10. **FR-10**: New sibling tasks MUST be announced to existing siblings
11. **FR-11**: Agents MUST be able to send direct messages to sibling tasks (via `task_send_message`)
12. **FR-12**: Agents MUST be able to get output from sibling tasks via `task_output`
13. **FR-13**: Agents MUST be able to send passive messages to specific tasks via `task_send_message` with `noReply: true`

### Non-Functional Requirements

1. **NFR-1**: Use existing session/message infrastructure (no custom storage)
2. **NFR-2**: Minimal latency for real-time parallel task scenarios
3. **NFR-3**: Broadcasts MUST NOT interrupt agent's current work flow
4. **NFR-4**: Implementation MUST follow existing tool patterns (`defineTool`)
5. **NFR-5**: Sibling injection MUST follow existing hook patterns (`defineHookSet`)

## Technical Context

### Available Infrastructure

```typescript
// Get sibling sessions via parent
const parent = await client.session.get({ sessionID }); // has parentID
const siblings = await client.session.children({ sessionID: parent.parentID });

// Inject message into session
await client.session.promptAsync({
  sessionID: targetSessionID,
  parts: [{ type: 'text', text: message, synthetic: true }],
  noReply: true, // Don't trigger agent response
});

// Session has: id, title, parentID, messages
```

### Constraints

- Sessions don't have built-in sibling awareness
- `promptAsync` with `noReply: true` injects without triggering response
- Messages with `synthetic: true` are marked as system-injected
- No pub/sub or event system between sessions

## Options Considered

### Option A: Direct Sibling Broadcast (Push Model) - Extended

**Approach**: Extend the push model from v1.0 with orchestrator participation and sibling injection.

**Pros**:

- Real-time delivery for parallel tasks
- Simple mental model: "broadcast and forget"
- Messages persist automatically in session history
- Works with existing infrastructure
- Orchestrator can coordinate via broadcasts

**Cons**:

- No delivery confirmation
- Completed siblings still receive (may never be read)
- Potential for broadcast spam if agents over-share
- Each broadcast is O(n) where n = recipient count

### Option B: Event-Based Pub/Sub

**Approach**: Implement a lightweight pub/sub system for task communication.

**Pros**:

- More scalable for large task counts
- Better delivery guarantees
- Can implement selective subscriptions

**Cons**:

- Requires new infrastructure
- More complex implementation
- Doesn't leverage existing session/message system

## Recommendation

**Option A: Direct Sibling Broadcast (Push Model) - Extended** because it builds on the proven v1.0 design, leverages existing infrastructure, and provides the simplest path to full bidirectional communication.

**Confidence**: High

**Rationale**:

1. **Proven foundation**: v1.0 design validated the push model approach
2. **Minimal new infrastructure**: Only adds hook for sibling injection
3. **Consistent patterns**: Uses existing `promptAsync` and hook patterns
4. **Incremental complexity**: Adds features without redesigning core

## Detailed Design

### Sibling Injection Hook

#### Purpose

Automatically inject sibling task IDs into task context so agents can communicate with siblings without manual discovery.

#### Hook Definition

```typescript
// src/features/tools/tasks/sibling-hook.ts
import { defineHookSet } from '~/hook/hook';
import { PluginContext } from '~/context';
import { Prompt } from '~/util/prompt';

export const siblingInjectionHooks = defineHookSet({
  id: 'sibling-injection-hooks',
  capabilities: ['Automatic sibling task ID injection'],
  hooks: () => {
    const { client, directory } = PluginContext.use();

    // Track sessions we've injected into
    const injectedSessions = new Map<string, Set<string>>(); // sessionID -> Set<siblingIDs>

    return {
      event: async ({ event }) => {
        // When a new task session is created
        if (event.type === 'session.created') {
          const sessionID = event.properties.sessionID;

          // Get session to check if it's a child task
          const sessionResult = await client.session.get({
            sessionID,
            directory,
          });
          if (sessionResult.error || !sessionResult.data.parentID) return;

          const { parentID } = sessionResult.data;

          // Get all sibling sessions
          const siblingsResult = await client.session.children({
            sessionID: parentID,
            directory,
          });
          if (siblingsResult.error) return;

          const siblings = siblingsResult.data.filter((s) => s.id !== sessionID);

          // 1. Inject existing siblings into new task
          if (siblings.length > 0) {
            const siblingList = await formatSiblingList(siblings);
            await injectSiblingContext(sessionID, siblingList);
            injectedSessions.set(sessionID, new Set(siblings.map((s) => s.id)));
          }

          // 2. Inject new task into existing siblings
          const newTaskInfo = await getTaskInfo(sessionID);
          for (const sibling of siblings) {
            const existingInjections = injectedSessions.get(sibling.id) || new Set();
            if (!existingInjections.has(sessionID)) {
              await injectNewSibling(sibling.id, newTaskInfo);
              existingInjections.add(sessionID);
              injectedSessions.set(sibling.id, existingInjections);
            }
          }
        }
      },
    };
  },
});
```

#### Injection Format

**Initial sibling context** (injected into new tasks):

```xml
<sibling_tasks>
You have sibling tasks working in parallel. You can communicate with them using:
- `task_broadcast`: Share discoveries with all siblings
- `task_send_message`: Send direct message to a specific sibling

| Task ID | Agent | Title |
|---------|-------|-------|
| session_abc123 | Caleb (explorer) | Explore config patterns |
| session_def456 | Berean (researcher) | Research API docs |
</sibling_tasks>
```

**New sibling announcement** (injected into existing tasks):

```xml
<new_sibling task_id="session_ghi789" agent="Baruch (executor)" title="Implement config loader">
A new sibling task has been created. You can communicate with it using `task_broadcast` or `task_send_message`.
</new_sibling>
```

#### Helper Functions

```typescript
async function formatSiblingList(siblings: Session[]): Promise<string> {
  const rows = await Promise.all(
    siblings.map(async (s) => {
      const agentResult = await getSessionAgentAndModel(s.id);
      const agent = agentResult.data?.agent || 'unknown';
      return `| ${s.id} | ${agent} | ${s.title} |`;
    }),
  );

  return Prompt.template`
    <sibling_tasks>
    You have sibling tasks working in parallel. You can communicate with them using:
    - \`task_broadcast\`: Share discoveries with all siblings
    - \`task_send_message\`: Send direct message to a specific sibling

    | Task ID | Agent | Title |
    |---------|-------|-------|
    ${rows.join('\n')}
    </sibling_tasks>
  `;
}

async function getTaskInfo(
  sessionID: string,
): Promise<{ id: string; agent: string; title: string }> {
  const { client, directory } = PluginContext.use();
  const sessionResult = await client.session.get({ sessionID, directory });
  const agentResult = await getSessionAgentAndModel(sessionID);

  return {
    id: sessionID,
    agent: agentResult.data?.agent || 'unknown',
    title: sessionResult.data?.title || 'Unknown task',
  };
}

async function injectSiblingContext(sessionID: string, content: string): Promise<void> {
  const { client, directory } = PluginContext.use();
  const agentResult = await getSessionAgentAndModel(sessionID);

  await client.session.promptAsync({
    sessionID,
    noReply: true,
    agent: agentResult.data?.agent,
    model: agentResult.data?.model,
    parts: [{ type: 'text', text: content, synthetic: true }],
    directory,
  });
}

async function injectNewSibling(
  sessionID: string,
  taskInfo: { id: string; agent: string; title: string },
): Promise<void> {
  const { client, directory } = PluginContext.use();
  const agentResult = await getSessionAgentAndModel(sessionID);

  const content = `<new_sibling task_id="${taskInfo.id}" agent="${taskInfo.agent}" title="${taskInfo.title}">
A new sibling task has been created. You can communicate with it using \`task_broadcast\` or \`task_send_message\`.
</new_sibling>`;

  await client.session.promptAsync({
    sessionID,
    noReply: true,
    agent: agentResult.data?.agent,
    model: agentResult.data?.model,
    parts: [{ type: 'text', text: content, synthetic: true }],
    directory,
  });
}
```

### Tool Specifications

#### `task_broadcast`

**Purpose**: Share a discovery or context with sibling tasks and/or child tasks.

**Arguments**:

```typescript
{
  message: z.string()
    .max(2000)
    .describe('The information to share. Be concise and actionable. Max 2000 characters.'),
  category: z.enum(['discovery', 'warning', 'context', 'blocker'])
    .default('discovery')
    .describe('Type of broadcast: discovery (found something), warning (avoid this), context (background info), blocker (need help)'),
  target: z.enum(['all', 'children', 'siblings'])
    .default('all')
    .describe('Who to broadcast to: siblings (peer tasks), children (delegated tasks), all (both)'),
}
```

**Returns**:

```typescript
{
  status: 'success' | 'partial' | 'failed',
  delivered_to: number,      // Count of recipients that received
  skipped: number,           // Count of recipients skipped (e.g., self)
  target: 'siblings' | 'children' | 'all',
  errors?: string[],         // Any delivery errors
}
```

**Behavior**:

1. Get current session's `parentID`
2. Based on `target`:
   - `'siblings'`: Get siblings via `client.session.children({ sessionID: parentID })`
   - `'children'`: Get children via `client.session.children({ sessionID: currentSession })`
   - `'all'`: Get both siblings and children
3. Filter out self (current session)
4. For each recipient, inject message with `promptAsync({ noReply: true })`
5. Return delivery summary

**Target Behavior Matrix**:

| Caller       | Target     | Recipients                             |
| ------------ | ---------- | -------------------------------------- |
| Subagent     | `siblings` | Peer tasks (same parent)               |
| Subagent     | `children` | Tasks delegated by this subagent       |
| Subagent     | `all`      | Siblings + own children                |
| Orchestrator | `siblings` | Error (orchestrator has no siblings)   |
| Orchestrator | `children` | All delegated tasks                    |
| Orchestrator | `all`      | All delegated tasks (same as children) |

**Error Handling**:

- No parent session + target includes siblings → `{ status: 'failed', error: 'Not a child task - cannot broadcast to siblings' }`
- No children + target includes children → `{ status: 'success', delivered_to: 0 }` (not an error)
- Partial delivery failure → `{ status: 'partial', delivered_to: N, errors: [...] }`
- All deliveries fail → `{ status: 'failed', errors: [...] }`

#### `task_broadcasts_read`

**Purpose**: Read broadcasts from sibling tasks or child tasks (for context sync).

**Arguments**:

```typescript
{
  category: z.enum(['discovery', 'warning', 'context', 'blocker', 'all'])
    .default('all')
    .describe('Filter broadcasts by category'),
  limit: z.number()
    .default(10)
    .describe('Maximum number of broadcasts to return'),
  source: z.enum(['self', 'children'])
    .default('self')
    .describe('Where to read broadcasts from: self (current session), children (child task sessions)'),
}
```

**Returns**:

```typescript
{
  broadcasts: Array<{
    from: string,           // Agent ID
    task_id: string,        // Source task session ID
    category: string,
    timestamp: string,      // ISO timestamp
    message: string,
    source: 'self' | 'child', // Where this broadcast was found
  }>,
  total: number,            // Total broadcasts available
}
```

**Behavior**:

1. Based on `source`:
   - `'self'`: Get current session's messages, parse for `<sibling_broadcast>` tags
   - `'children'`: Get all child sessions, parse each for `<sibling_broadcast>` tags
2. Apply category filter and limit
3. Return structured broadcast data with source indicator

**Source Behavior Matrix**:

| Caller       | Source     | Result                                                       |
| ------------ | ---------- | ------------------------------------------------------------ |
| Subagent     | `self`     | Broadcasts received in current session                       |
| Subagent     | `children` | Broadcasts in any tasks this subagent delegated              |
| Orchestrator | `self`     | Broadcasts received in orchestrator session (typically none) |
| Orchestrator | `children` | Broadcasts in all delegated tasks (primary use case)         |

### Message Format

**Injected Broadcast** (into recipient sessions):

```xml
<sibling_broadcast from="Caleb (explorer)" task_id="session_abc123" category="discovery" timestamp="2026-01-26T19:30:00Z">
Config file location discovered:
- Path: src/config.ts
- Exports: ConfigContext, PluginContext
- Pattern: Use ConfigContext.use() to access config
</sibling_broadcast>
```

**Format Rationale**:

- XML tags for clear parsing
- `from` identifies source agent for context
- `task_id` enables tracing back to source
- `category` enables filtering
- `timestamp` enables ordering and freshness checks
- Content is free-form for flexibility

### Permission Model

| Agent Type      | `task_broadcast` | `task_broadcasts_read` |
| --------------- | ---------------- | ---------------------- |
| Orchestrator    | allow            | allow                  |
| Subagents (all) | allow            | allow                  |

**Rationale**:

- Orchestrator needs to broadcast coordination messages to children
- Orchestrator needs to read child broadcasts for situational awareness
- All subagents can share and receive discoveries
- No special permissions needed - tools are opt-in

**Change from v1.0**: Orchestrator was previously denied access. Now included to enable full bidirectional communication.

### `task_send_message` Scope Expansion

**Current behavior**: `task_send_message` only works for child tasks (validates against `client.session.children`).

**Expanded scope**: With sibling injection, agents now know sibling task IDs. Document that `task_send_message` can be used for sibling communication once IDs are known.

**Implementation note**: The current implementation already accepts any `task_id` and validates against children. To support siblings:

```typescript
// Option 1: Expand validation to include siblings
const childrenResult = await client.session.children({
  sessionID: toolCtx.sessionID,
});
const siblingsResult = await getSiblingSessionsFromChild(toolCtx.sessionID);
const validTargets = [...childrenResult.data, ...siblingsResult.data.siblings];

// Option 2: Remove validation entirely (trust the agent)
// Just attempt to send to the provided task_id
```

**Recommendation**: Option 1 (expand validation) for safety while maintaining the ability to send to siblings.

#### `noReply` Parameter (v2.1)

**Purpose**: Enable passive directed messages to specific tasks without triggering a response.

**Updated Arguments**:

```typescript
{
  task_id: z.string()
    .describe('The task ID to send the message to (child or sibling)'),
  message: z.string()
    .describe('The message to send'),
  noReply: z.boolean()
    .default(false)
    .describe('If true, inject message without triggering a response. Useful for passive notifications.'),
}
```

**Behavior**:

| `noReply`         | Behavior                                                | Use Case                                       |
| ----------------- | ------------------------------------------------------- | ---------------------------------------------- |
| `false` (default) | Current behavior - triggers response from recipient     | Directed questions, requests for action        |
| `true`            | Passive injection like broadcasts, but to specific task | Notifications, context sharing, status updates |

**Implementation**:

```typescript
await client.session.promptAsync({
  sessionID: targetSessionID,
  parts: [{ type: 'text', text: message, synthetic: noReply }],
  noReply: noReply,
  // ... other params
});
```

**Rationale**: This bridges the gap between `task_broadcast` (undirected, passive) and `task_send_message` (directed, active). Sometimes an agent needs to share information with a specific sibling without expecting or requiring a response - similar to a broadcast but targeted.

### Protocol Addition

Add to agent prompts for all agents (including orchestrator):

```typescript
export const siblingCommunication = (self: AgentSelf) => Prompt.template`
  <sibling_communication>
    ${Prompt.when(
      self.canDelegate,
      `
    ### Orchestrator Communication
    As an orchestrator, you can:
    - **Broadcast to children**: \`task_broadcast({ target: 'children', ... })\` to share context with all delegated tasks
    - **Read child broadcasts**: \`task_broadcasts_read({ source: 'children' })\` to see what tasks discovered
    `,
    )}
    
    ${Prompt.when(
      !self.isOrchestrator,
      `
    ### Sibling Communication
    You can share discoveries with sibling tasks using \`task_broadcast\`.
    
    #### When to Broadcast
    - **Discovery**: Found important file, pattern, or configuration
    - **Warning**: Encountered a gotcha or anti-pattern to avoid
    - **Context**: Background info that helps understand the codebase
    - **Blocker**: Stuck and need sibling awareness (not help request)
    
    #### Broadcast Guidelines
    - Be concise: 2-5 lines, actionable information
    - Include specifics: file paths, function names, patterns
    - Don't broadcast obvious things (e.g., "found package.json")
    - Don't broadcast your task progress (that's for parent)
    
    #### Reading Broadcasts
    Use \`task_broadcasts_read\` at the start of complex tasks to sync context.
    Sibling discoveries may save you from redundant searches.
    
    #### Direct Sibling Messages
    Use \`task_send_message\` with a sibling's task ID for directed communication.
    Sibling IDs are provided in your \`<sibling_tasks>\` context.
    `,
    )}
    
    ### Example Good Broadcast
    \`\`\`
    task_broadcast({
      message: "Config pattern: Use ConfigContext.use() not direct import. File: src/context.ts",
      category: "discovery",
      target: "siblings"
    })
    \`\`\`
  </sibling_communication>
`;
```

### Loop Prevention

**Problem**: Agent A broadcasts → Agent B receives → Agent B broadcasts response → infinite loop

**Solution**: Multiple layers of protection:

1. **`noReply: true`**: Broadcasts don't trigger agent responses
2. **No broadcast-on-receive**: Protocol explicitly states broadcasts are passive
3. **Category semantics**: `blocker` category is for awareness, not help requests
4. **Self-filtering**: Tool filters out current session from recipients
5. **Sibling injection is passive**: Uses `noReply: true`, doesn't trigger responses

**Additional safeguard** (if needed):

```typescript
// Track broadcast count per session to detect spam
const BROADCAST_LIMIT_PER_SESSION = 10;
const broadcastCounts = new Map<string, number>();
```

### Edge Cases

| Scenario                            | Behavior                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- |
| No siblings exist                   | Return `{ status: 'success', delivered_to: 0 }`                            |
| No children exist                   | Return `{ status: 'success', delivered_to: 0 }`                            |
| All siblings completed              | Still deliver (for resurrection)                                           |
| Sibling session deleted             | Skip with warning in errors array                                          |
| Very long message                   | Reject with error (max 2000 chars enforced in schema)                      |
| Rapid broadcasts                    | Allow (rate limiting is future enhancement)                                |
| Broadcast to self                   | Filtered out automatically                                                 |
| Parent session gone                 | Return error for sibling target (orphaned task)                            |
| Orchestrator broadcasts to siblings | Return error (orchestrator has no siblings)                                |
| Leaf task with no siblings          | Sibling injection provides empty list, broadcasts succeed with 0 delivered |
| Task created before hook runs       | Hook fires on `session.created` event, should catch all                    |

### Integration with Existing Tools

**Relationship to `task_send_message`**:

- `task_send_message`: Directed message to specific task (child OR sibling)
- `task_send_message` with `noReply: true`: Passive directed message (like broadcast but targeted)
- `task_broadcast`: Undirected message to group (siblings, children, or all)

**Relationship to `task_output`**:

- `task_output`: Get task results (children AND siblings)
- `task_broadcasts_read`: Get in-flight discoveries

**Relationship to `task_create`**:

- `task_create`: Creates child task, triggers sibling injection hook
- Sibling injection: Announces new task to existing siblings

#### `task_output` Sibling Support (v2.1)

**Current behavior**: `task_output` only validates against child tasks.

**Expanded scope**: With sibling injection, agents know sibling task IDs and should be able to check sibling progress/results.

**Use Cases**:

1. **Check sibling progress**: Agent wants to see if a sibling has completed before proceeding
2. **Get sibling results**: Agent needs output from a sibling task without waiting for broadcast
3. **Coordinate work**: Agent checks what siblings have produced to avoid duplication

**Implementation**:

```typescript
// Expand validation to include siblings (same pattern as task_send_message)
const childrenResult = await client.session.children({
  sessionID: toolCtx.sessionID,
});
const siblingsResult = await getSiblingSessionsFromChild(toolCtx.sessionID);
const validTargets = [...childrenResult.data, ...siblingsResult.data.siblings];

// Validate task_id against validTargets
if (!validTargets.some((t) => t.id === task_id)) {
  return { error: 'Invalid task ID - must be a child or sibling task' };
}
```

**Behavior Matrix**:

| Caller       | Target       | Result                                         |
| ------------ | ------------ | ---------------------------------------------- |
| Subagent     | Child task   | Output from delegated task (existing behavior) |
| Subagent     | Sibling task | Output from peer task (NEW)                    |
| Orchestrator | Child task   | Output from delegated task (existing behavior) |
| Orchestrator | Invalid ID   | Error: Invalid task ID                         |

## Implementation Notes

### File Changes Required

1. **`src/features/tools/tasks/sibling-hook.ts`** (NEW)
   - Define `siblingInjectionHooks` hook set
   - Implement sibling context injection on task creation
   - Implement new sibling announcement to existing siblings

2. **`src/features/tools/tasks/broadcast.ts`** (NEW)
   - Add `taskBroadcastTool` definition with `target` parameter
   - Add `taskBroadcastsReadTool` definition with `source` parameter
   - Export in `taskToolSet`

3. **`src/features/tools/tasks/index.ts`**
   - Import and export broadcast tools
   - Update `taskToolSet` to include broadcast tools
   - Update `taskSendMessageTool` to validate against siblings too
   - Update `taskSendMessageTool` to add `noReply` parameter
   - Update `taskOutputTool` to validate against siblings

4. **`src/features/tools/tasks/types.ts`**
   - Add `BroadcastResult` type
   - Add `Broadcast` type for parsed broadcasts
   - Add `BroadcastTarget` type

5. **`src/util/session.ts`**
   - Add `getSiblingSessionsFromChild(sessionID)` helper
   - Add `parseSessionBroadcasts(sessionID)` helper
   - Add `getChildSessionBroadcasts(sessionID)` helper

6. **`src/util/prompt/protocols.ts`**
   - Add `Protocol.siblingCommunication`

7. **`src/hook/hooks.ts`**
   - Import and register `siblingInjectionHooks`

8. **Agent prompts** (all agents)
   - Add `${Protocol.siblingCommunication(self)}` to agent prompts

### Helper Functions

```typescript
// src/util/session.ts

export async function getSiblingSessionsFromChild(sessionID: string) {
  const { client, directory } = PluginContext.use();

  // Get current session to find parent
  const sessionResult = await client.session.get({ sessionID, directory });
  if (sessionResult.error) return { error: sessionResult.error };

  const { parentID } = sessionResult.data;
  if (!parentID) {
    return { error: { code: 'NO_PARENT', message: 'Session has no parent' } };
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
}

export function formatBroadcastMessage(
  agentName: string,
  taskId: string,
  category: string,
  message: string,
): string {
  const timestamp = new Date().toISOString();
  return `<sibling_broadcast from="${agentName}" task_id="${taskId}" category="${category}" timestamp="${timestamp}">
${message}
</sibling_broadcast>`;
}

export function parseBroadcasts(messages: Message[]): Broadcast[] {
  const broadcasts: Broadcast[] = [];
  const regex =
    /<sibling_broadcast from="([^"]+)" task_id="([^"]+)" category="([^"]+)" timestamp="([^"]+)">([\s\S]*?)<\/sibling_broadcast>/g;

  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === 'text') {
        let match;
        while ((match = regex.exec(part.text)) !== null) {
          broadcasts.push({
            from: match[1],
            task_id: match[2],
            category: match[3],
            timestamp: match[4],
            message: match[5].trim(),
          });
        }
      }
    }
  }

  return broadcasts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export async function getChildSessionBroadcasts(sessionID: string): Promise<Broadcast[]> {
  const { client, directory } = PluginContext.use();

  const childrenResult = await client.session.children({
    sessionID,
    directory,
  });
  if (childrenResult.error) return [];

  const allBroadcasts: Broadcast[] = [];

  for (const child of childrenResult.data) {
    const messagesResult = await client.session.messages({
      sessionID: child.id,
      directory,
    });
    if (messagesResult.error) continue;

    const broadcasts = parseBroadcasts(messagesResult.data);
    allBroadcasts.push(...broadcasts.map((b) => ({ ...b, source: 'child' as const })));
  }

  return allBroadcasts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
```

### Testing Strategy

1. **Unit Tests**:
   - `formatBroadcastMessage` produces valid XML
   - `parseBroadcasts` extracts all broadcasts from messages
   - `getSiblingSessionsFromChild` handles no-parent case
   - `getChildSessionBroadcasts` aggregates from multiple children
   - Sibling list formatting includes all required fields

2. **Integration Tests**:
   - Broadcast from Task A appears in Task B's messages
   - `task_broadcasts_read` returns parsed broadcasts
   - Completed siblings receive broadcasts
   - Orchestrator can broadcast to children
   - Orchestrator can read child broadcasts
   - Sibling injection fires on task creation
   - New sibling announcement reaches existing siblings

3. **E2E Tests**:
   - Orchestrator creates parallel tasks
   - Explorer broadcasts discovery
   - Executor reads broadcast and uses information
   - Orchestrator reads child broadcasts for status
   - New task receives sibling context on creation

## Acceptance Criteria

### AC-1: Broadcast Delivery

- [ ] `task_broadcast` delivers message to all sibling sessions when `target: 'siblings'`
- [ ] `task_broadcast` delivers message to all child sessions when `target: 'children'`
- [ ] `task_broadcast` delivers message to both when `target: 'all'`
- [ ] Message appears in recipient's session history
- [ ] Self is excluded from recipients
- [ ] Return value includes delivery count and target

### AC-2: Broadcast Reading

- [ ] `task_broadcasts_read` with `source: 'self'` returns broadcasts in current session
- [ ] `task_broadcasts_read` with `source: 'children'` returns broadcasts from child sessions
- [ ] Category filtering works correctly
- [ ] Broadcasts are ordered by timestamp (newest first)
- [ ] Limit parameter is respected
- [ ] Source indicator is included in results

### AC-3: Message Format

- [ ] Broadcasts use XML format with required attributes
- [ ] Broadcasts are parseable by `parseBroadcasts`
- [ ] Messages over 2000 characters are rejected with clear error

### AC-4: Loop Prevention

- [ ] Broadcasts use `noReply: true`
- [ ] Receiving a broadcast does not trigger agent response
- [ ] No infinite loops in parallel task scenarios
- [ ] Sibling injection uses `noReply: true`

### AC-5: Error Handling

- [ ] Non-child sessions get clear error message when targeting siblings
- [ ] Orchestrator targeting siblings gets clear error message
- [ ] Partial delivery failures are reported
- [ ] Deleted sibling sessions are skipped gracefully

### AC-6: Agent Integration

- [ ] All agent prompts include sibling communication protocol
- [ ] Agents use broadcasts appropriately (not spam)
- [ ] Orchestrator can use broadcast tools
- [ ] Subagents can use broadcast tools

### AC-7: Sibling Injection

- [ ] New tasks receive `<sibling_tasks>` context with existing sibling IDs
- [ ] Existing siblings receive `<new_sibling>` announcement for new tasks
- [ ] Injection uses `noReply: true` (passive)
- [ ] Injection includes task ID, agent name, and title
- [ ] Hook fires on `session.created` event

### AC-8: `task_send_message` Sibling Support

- [ ] `task_send_message` validates against both children and siblings
- [ ] Agents can send direct messages to siblings using injected IDs
- [ ] Error message is clear when task ID is invalid

### AC-9: `task_output` Sibling Support

- [ ] `task_output` validates against both children and siblings
- [ ] Agents can get sibling task output using injected IDs
- [ ] Error message is clear when task ID is invalid

### AC-10: `task_send_message` noReply Option

- [ ] `noReply: true` injects message without triggering response
- [ ] `noReply: false` (default) triggers response as before
- [ ] Uses `synthetic: true` flag when `noReply: true`

## Risks

| Risk                                | Impact | Likelihood | Mitigation                               |
| ----------------------------------- | ------ | ---------- | ---------------------------------------- |
| Broadcast spam degrades performance | High   | Medium     | Protocol guidance, future rate limiting  |
| Agents ignore broadcasts            | Medium | Medium     | Prompt emphasis on reading at task start |
| Message parsing fails on edge cases | Medium | Low        | Robust regex, fallback to raw text       |
| Large sibling count causes latency  | Medium | Low        | Async delivery, consider batching        |
| Broadcasts create context bloat     | Medium | Medium     | Concise message guidance, truncation     |
| Sibling injection race condition    | Medium | Low        | Hook fires on event, not polling         |
| Compaction loses broadcast context  | Medium | Medium     | Trust LLM summarization for MVP          |

## Future Enhancements

1. **Rate limiting**: Cap broadcasts per session per minute
2. **Broadcast acknowledgment**: Track which recipients read broadcasts
3. **Priority broadcasts**: Interrupt agent for critical discoveries
4. **Broadcast expiry**: Auto-expire old broadcasts on compaction
5. **Selective targeting**: Broadcast to specific agent types only
6. **Sibling context refresh**: Re-inject sibling list after compaction
7. **Broadcast aggregation**: Summarize multiple broadcasts into digest

## Resolved Questions (from v1.0)

1. **Should broadcasts survive session compaction?**
   - **Decision**: Trust LLM summarization for MVP. No special handling.

2. **Should orchestrator see child broadcasts?**
   - **Decision**: Yes. Added `source: 'children'` parameter to `task_broadcasts_read`.

3. **Maximum message length?**
   - **Decision**: 2000 characters. Enforced in schema with `z.string().max(2000)`.

## Resolved Questions (from v2.0)

1. **Should `task_send_message` trigger a response from the recipient?**
   - **Decision**: Default behavior triggers response, but added `noReply: true` option for passive directed messages (v2.1)

## Open Questions

1. **Should sibling injection include task status?**
   - Current design only injects ID, agent, and title
   - Could add `status: 'running' | 'completed'` for better awareness
   - **Recommendation**: Defer to future enhancement

2. **How to handle sibling injection for very large task counts (10+ siblings)?**
   - Current design injects all siblings
   - Could truncate or summarize for large counts
   - **Recommendation**: Defer until proven problem
