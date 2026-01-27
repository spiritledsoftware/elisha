# Plan: Sibling Task Communication

**Version**: 2.0
**Last Updated**: 2026-01-27T00:00:00Z
**Last Agent**: planner
**Status**: Draft
**Complexity**: High
**Tasks**: 18

## Overview

Implement sibling task communication for the Elisha agent swarm based on spec v2.1. This includes broadcast tools, sibling injection hooks, expanded validation for existing tools, and protocol updates for all agents. Enables parallel tasks to share discoveries, orchestrators to coordinate via broadcasts, and automatic sibling awareness.

## Dependencies

- Spec: `.agent/specs/sibling-communication.md` v2.1 (authoritative design source)
- Existing task tools in `src/features/tools/tasks/index.ts`
- Existing task hooks in `src/features/tools/tasks/hooks.ts`
- Session utilities in `src/util/session.ts`
- Protocol definitions in `src/util/prompt/protocols.ts`
- `PluginContext.use()` for client access
- `client.session.promptAsync({ noReply: true })` for passive message injection

## Functional Requirements Mapping

| FR | Description | Tasks |
|----|-------------|-------|
| FR-1 | Broadcast to siblings | 3.1 |
| FR-2 | Broadcasts persist in history | 3.1 |
| FR-3 | Works for parallel and sequential tasks | 3.1, 3.2 |
| FR-4 | Prevent broadcast storms | 3.1 (noReply) |
| FR-5 | Completed tasks receive broadcasts | 3.1 |
| FR-6 | Read broadcasts without triggering responses | 3.2 |
| FR-7 | Orchestrator broadcast to children | 3.1 |
| FR-8 | Orchestrator read child broadcasts | 3.2 |
| FR-9 | Auto-inject sibling IDs on task creation | 4.1 |
| FR-10 | Announce new siblings to existing tasks | 4.1 |
| FR-11 | Direct sibling messaging | 5.1 |
| FR-12 | Sibling output access | 5.2 |
| FR-13 | Passive directed messages (noReply) | 5.1 |

## Tasks

### Phase 1: Type Definitions (Sequential)

> Types must exist before tools and utilities can use them

#### 1.1 Add Broadcast Types to Task Types

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/types.ts`
**Depends on**: none
**Addresses**: Foundation for FR-1 through FR-8

Add new types for the broadcast system:

1. `BroadcastCategory` - Union type: `'discovery' | 'warning' | 'context' | 'blocker'`
2. `BroadcastTarget` - Union type: `'all' | 'children' | 'siblings'`
3. `Broadcast` - Parsed broadcast structure:

   ```typescript
   {
     from: string;           // Agent ID
     task_id: string;        // Source task session ID
     category: BroadcastCategory;
     timestamp: string;      // ISO timestamp
     message: string;
     source?: 'self' | 'child';  // Where broadcast was found
   }
   ```

4. `BroadcastResult` - Return type for `task_broadcast`:

   ```typescript
   {
     status: 'success' | 'partial' | 'failed';
     delivered_to: number;
     skipped: number;
     target: BroadcastTarget;
     errors?: string[];
   }
   ```

5. `BroadcastsReadResult` - Return type for `task_broadcasts_read`:

   ```typescript
   {
     broadcasts: Broadcast[];
     total: number;
   }
   ```

**Done when**:

- [ ] `BroadcastCategory` type exported
- [ ] `BroadcastTarget` type exported
- [ ] `Broadcast` type exported with all required fields including optional `source`
- [ ] `BroadcastResult` type exported with status variants
- [ ] `BroadcastsReadResult` type exported
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `TaskResult` discriminated union in same file
- Constraint: Keep types simple, avoid deep nesting

**Acceptance Criteria**: AC-3 (message format types)

---

### Phase 2: Session Utilities (Sequential)

> Utilities must exist before tools can use them

#### 2.1 Add Sibling Session Helper

**Agent**: Baruch (executor)
**File**: `src/util/session.ts`
**Depends on**: none
**Addresses**: Foundation for FR-1, FR-11, FR-12

Add `getSiblingSessionsFromChild(sessionID: string)` function that:

1. Gets current session to find `parentID` via `client.session.get()`
2. If no parent, returns error `{ code: 'NO_PARENT', message: 'Session has no parent' }`
3. Gets all sibling sessions via `client.session.children({ sessionID: parentID })`
4. Filters out self (current session)
5. Returns `{ data: { siblings, parentID } }` or `{ error }`

**Done when**:

- [ ] Function exported from `src/util/session.ts`
- [ ] Handles no-parent case with clear error
- [ ] Filters out current session from siblings
- [ ] Returns both siblings array and parentID
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `getChildSessions` function in same file
- Use `PluginContext.use()` for client/directory access

---

#### 2.2 Add Related Sessions Helper

**Agent**: Baruch (executor)
**File**: `src/util/session.ts`
**Depends on**: 2.1
**Addresses**: FR-11, FR-12 (validation expansion)

Add `getRelatedSessions(sessionID: string)` function that:

1. Gets child sessions via `getChildSessions(sessionID)`
2. Gets sibling sessions via `getSiblingSessionsFromChild(sessionID)`
3. Combines both into single array (deduped)
4. Returns `{ data: Session[] }` or `{ error }`

This helper is used by `task_output` and `task_send_message` for expanded validation.

**Done when**:

- [ ] Function exported from `src/util/session.ts`
- [ ] Combines children and siblings
- [ ] Handles case where session has no parent (returns only children)
- [ ] No duplicate sessions in result
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `getChildSessions` function
- Note: If no parent, siblings will be empty array (not an error)

---

#### 2.3 Add Broadcast Message Formatter

**Agent**: Baruch (executor)
**File**: `src/util/session.ts`
**Depends on**: none
**Addresses**: FR-1, FR-2, AC-3

Add `formatBroadcastMessage(agentName, taskId, category, message)` function that:

1. Generates ISO timestamp
2. Returns XML-formatted broadcast string:

   ```xml
   <sibling_broadcast from="..." task_id="..." category="..." timestamp="...">
   [message content]
   </sibling_broadcast>
   ```

**Done when**:

- [ ] Function exported from `src/util/session.ts`
- [ ] Produces valid XML with all required attributes
- [ ] Timestamp is ISO format
- [ ] Message content is trimmed
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `formatMessageParts` function in same file
- Constraint: Do NOT truncate here - schema enforces 2000 char limit

---

#### 2.4 Add Broadcast Parser

**Agent**: Baruch (executor)
**File**: `src/util/session.ts`
**Depends on**: 1.1
**Addresses**: FR-6, FR-8, AC-2

Add `parseBroadcasts(messages: Message[])` function that:

1. Iterates through all messages and their text parts
2. Uses regex to extract `<sibling_broadcast>` elements
3. Parses attributes: `from`, `task_id`, `category`, `timestamp`
4. Extracts message content between tags
5. Returns array of `Broadcast` objects sorted by timestamp (newest first)

**Done when**:

- [ ] Function exported from `src/util/session.ts`
- [ ] Correctly parses all broadcast attributes
- [ ] Handles multiple broadcasts in single message
- [ ] Returns sorted array (newest first)
- [ ] Skips malformed broadcasts gracefully
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: See spec for regex pattern
- Import `Broadcast` type from `~/features/tools/tasks/types`
- Handle edge case: malformed broadcasts should be skipped, not throw

---

#### 2.5 Add Child Session Broadcasts Helper

**Agent**: Baruch (executor)
**File**: `src/util/session.ts`
**Depends on**: 2.4
**Addresses**: FR-8, AC-2

Add `getChildSessionBroadcasts(sessionID: string)` function that:

1. Gets all child sessions via `getChildSessions(sessionID)`
2. For each child, gets messages and parses broadcasts
3. Adds `source: 'child'` to each broadcast
4. Returns combined array sorted by timestamp (newest first)

**Done when**:

- [ ] Function exported from `src/util/session.ts`
- [ ] Aggregates broadcasts from all children
- [ ] Each broadcast has `source: 'child'` indicator
- [ ] Returns sorted array (newest first)
- [ ] Handles errors gracefully (skips failed children)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `fetchSessionOutput` for message iteration
- Note: This is for orchestrator to read child broadcasts

---

### Phase 3: New Tool Implementation (Parallel)

> Both tools can be implemented concurrently after Phase 2

#### 3.1 Implement task_broadcast Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: 1.1, 2.1, 2.3
**Parallel group**: A
**Addresses**: FR-1, FR-2, FR-4, FR-5, FR-7, AC-1, AC-4, AC-5

Add `taskBroadcastTool` using `defineTool` pattern:

**Arguments**:

- `message: z.string().max(2000)` - The information to share
- `category: z.enum(['discovery', 'warning', 'context', 'blocker']).default('discovery')`
- `target: z.enum(['all', 'children', 'siblings']).default('all')`

**Execute logic**:

1. Get current session's agent name from `toolCtx.agent`
2. Based on `target`:
   - `'siblings'`: Call `getSiblingSessionsFromChild(toolCtx.sessionID)`
   - `'children'`: Call `getChildSessions(toolCtx.sessionID)`
   - `'all'`: Get both
3. Handle errors:
   - No parent + target includes siblings → `{ status: 'failed', error: 'Not a child task - cannot broadcast to siblings' }`
   - Orchestrator + target='siblings' → `{ status: 'failed', error: 'Orchestrator has no siblings' }`
4. Format message using `formatBroadcastMessage`
5. For each recipient, inject with `client.session.promptAsync({ noReply: true, parts: [{ type: 'text', text: message, synthetic: true }] })`
6. Track delivery count and errors
7. Return `BroadcastResult`

**Done when**:

- [ ] Tool defined with ID `elisha_task_broadcast`
- [ ] Arguments match spec schema with `target` parameter
- [ ] Handles no-parent case with clear error for sibling target
- [ ] Handles orchestrator-to-siblings case with clear error
- [ ] Injects message to all recipients with `noReply: true` and `synthetic: true`
- [ ] Returns delivery count, skipped count, target, and any errors
- [ ] Self is excluded from recipients
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `taskSendMessageTool` in same file
- Use `TASK_TOOLSET_ID` prefix for tool ID
- Constraint: Must use `noReply: true` to prevent response loops (AC-4)

---

#### 3.2 Implement task_broadcasts_read Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: 1.1, 2.4, 2.5
**Parallel group**: A
**Addresses**: FR-6, FR-8, AC-2

Add `taskBroadcastsReadTool` using `defineTool` pattern:

**Arguments**:

- `category: z.enum(['discovery', 'warning', 'context', 'blocker', 'all']).default('all')`
- `limit: z.number().default(10)`
- `source: z.enum(['self', 'children']).default('self')`

**Execute logic**:

1. Based on `source`:
   - `'self'`: Get current session's messages, call `parseBroadcasts(messages)`, add `source: 'self'`
   - `'children'`: Call `getChildSessionBroadcasts(toolCtx.sessionID)`
2. Apply category filter if not 'all'
3. Apply limit
4. Return `BroadcastsReadResult` with broadcasts array and total count (before limit)

**Done when**:

- [ ] Tool defined with ID `elisha_task_broadcasts_read`
- [ ] Arguments match spec schema with `source` parameter
- [ ] `source: 'self'` returns broadcasts in current session
- [ ] `source: 'children'` returns broadcasts from child sessions
- [ ] Category filtering works correctly
- [ ] Limit is respected
- [ ] Returns total count (before limit applied)
- [ ] Source indicator included in each broadcast
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `taskOutputTool` in same file
- Use `TASK_TOOLSET_ID` prefix for tool ID

---

#### 3.3 Register New Tools in ToolSet

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: 3.1, 3.2

Update `taskToolSet` to include the new tools:

```typescript
export const taskToolSet = defineToolSet({
  id: TASK_TOOLSET_ID,
  config: async () => ({
    [taskCreateTool.id]: await taskCreateTool.setup(),
    [taskOutputTool.id]: await taskOutputTool.setup(),
    [taskSendMessageTool.id]: await taskSendMessageTool.setup(),
    [taskCancelTool.id]: await taskCancelTool.setup(),
    [taskBroadcastTool.id]: await taskBroadcastTool.setup(),
    [taskBroadcastsReadTool.id]: await taskBroadcastsReadTool.setup(),
  }),
});
```

**Done when**:

- [ ] Both new tools added to `taskToolSet.config`
- [ ] Tools are exported from the module
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Follow existing tool registration in `taskToolSet`

---

### Phase 4: Sibling Injection Hook (Sequential)

> Hook must be added to existing hooks file

#### 4.1 Add Sibling Injection to Task Hooks

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/hooks.ts`
**Depends on**: 2.1
**Addresses**: FR-9, FR-10, AC-7

Extend the existing `taskHooks` hook set to add sibling injection on `session.created` event:

**New functionality in `event` handler**:

1. When `event.type === 'session.created'`:
   - Get session to check if it's a child task (has `parentID`)
   - If not a child task, skip
   - Get all sibling sessions via parent
   - **Inject existing siblings into new task**: Format `<sibling_tasks>` table and inject with `noReply: true`
   - **Announce new task to existing siblings**: Inject `<new_sibling>` into each sibling with `noReply: true`
   - Track injected sessions to avoid duplicates

**Injection formats** (from spec):

```xml
<sibling_tasks>
You have sibling tasks working in parallel. You can communicate with them using:
- `task_broadcast`: Share discoveries with all siblings
- `task_send_message`: Send direct message to a specific sibling

| Task ID | Agent | Title |
|---------|-------|-------|
| session_abc123 | Caleb (explorer) | Explore config patterns |
</sibling_tasks>
```

```xml
<new_sibling task_id="session_ghi789" agent="Baruch (executor)" title="Implement config loader">
A new sibling task has been created. You can communicate with it using `task_broadcast` or `task_send_message`.
</new_sibling>
```

**Done when**:

- [ ] `session.created` event handler added to existing `taskHooks`
- [ ] New tasks receive `<sibling_tasks>` context with existing sibling IDs
- [ ] Existing siblings receive `<new_sibling>` announcement
- [ ] Injection uses `noReply: true` (passive)
- [ ] Injection includes task ID, agent name, and title
- [ ] Duplicate injections prevented via tracking
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing `session.status` and `session.compacted` handlers in same file
- Use `getSessionAgentAndModel` for agent/model info
- Note: Hook already exists - ADD to it, don't replace

---

### Phase 5: Existing Tool Modifications (Parallel)

> Both modifications can run concurrently

#### 5.1 Expand task_send_message Validation + Add noReply

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: 2.2
**Parallel group**: B
**Addresses**: FR-11, FR-13, AC-8, AC-10

Modify `taskSendMessageTool`:

1. **Expand validation**: Replace `client.session.children()` with `getRelatedSessions()` to validate against both children AND siblings
2. **Add `noReply` parameter**:

   ```typescript
   noReply: z.boolean()
     .default(false)
     .describe('If true, inject message without triggering a response. Useful for passive notifications.')
   ```

3. **Update execute logic**:
   - When `noReply: true`: Use `synthetic: true` flag and `noReply: true` in `promptAsync`
   - When `noReply: false` (default): Current behavior (triggers response)

**Done when**:

- [ ] Validation uses `getRelatedSessions()` instead of just children
- [ ] `noReply` parameter added to args schema
- [ ] `noReply: true` injects without triggering response
- [ ] `noReply: false` (default) triggers response as before
- [ ] Uses `synthetic: true` flag when `noReply: true`
- [ ] Error message updated: "Invalid task ID - must be a child or sibling task"
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: See existing `taskSendMessageTool` implementation
- Constraint: Default behavior must remain unchanged (backward compatible)

---

#### 5.2 Expand task_output Validation

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: 2.2
**Parallel group**: B
**Addresses**: FR-12, AC-9

Modify `taskOutputTool`:

1. **Expand validation**: Replace `getChildSessions()` with `getRelatedSessions()` to validate against both children AND siblings
2. **Update error message**: "Invalid task ID - must be a child or sibling task"

**Done when**:

- [ ] Validation uses `getRelatedSessions()` instead of just children
- [ ] Agents can get sibling task output using injected IDs
- [ ] Error message updated for invalid task ID
- [ ] Existing child task output behavior unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: See existing `taskOutputTool` implementation
- Note: Only validation changes - rest of logic stays the same

---

### Phase 6: Protocol Addition (Sequential)

> Protocol must exist before agents can reference it

#### 6.1 Add Protocol.siblingCommunication

**Agent**: Baruch (executor)
**File**: `src/util/prompt/protocols.ts`
**Depends on**: none
**Addresses**: AC-6

Add `siblingCommunication` function to the Protocol namespace that takes `self: ElishaAgent` and returns dynamic content:

```typescript
export function siblingCommunication(self: ElishaAgent) {
  return Prompt.template`
    <sibling_communication>
      ${Prompt.when(
        self.canDelegate,
        `
      ### Orchestrator Communication
      As an orchestrator, you can:
      - **Broadcast to children**: \`task_broadcast({ target: 'children', ... })\` to share context with all delegated tasks
      - **Read child broadcasts**: \`task_broadcasts_read({ source: 'children' })\` to see what tasks discovered
      `
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
      `
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
}
```

**Done when**:

- [ ] `Protocol.siblingCommunication(self)` exported from namespace
- [ ] Takes `ElishaAgent` parameter for dynamic content
- [ ] Shows orchestrator section when `self.canDelegate`
- [ ] Shows sibling section when `!self.isOrchestrator`
- [ ] Includes when to broadcast, guidelines, reading instructions, example
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `Protocol.contextGathering(agent)` and `Protocol.escalation(agent)` in same file
- Note: Need to check if `self.isOrchestrator` property exists - may need to use `self.id` check
- Constraint: Keep concise - agents have limited context windows

---

### Phase 7: Agent Prompt Updates (Parallel)

> All depend on Phase 6. Can run concurrently since they modify different files.

#### 7.1 Add Sibling Communication to Orchestrator

**Agent**: Baruch (executor)
**File**: `src/features/agents/orchestrator.ts`
**Depends on**: 6.1
**Parallel group**: C
**Addresses**: AC-6

Add `${Protocol.siblingCommunication(self)}` to the `<protocols>` section in the orchestrator agent prompt.

Orchestrator uses this to broadcast to children and read child broadcasts.

**Done when**:

- [ ] `Protocol.siblingCommunication(self)` added to protocols section
- [ ] Import added for Protocol if not present
- [ ] Existing protocols unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add to `<protocols>` section
- Note: Orchestrator gets the "orchestrator" variant of the protocol

---

#### 7.2 Add Sibling Communication to Explorer

**Agent**: Baruch (executor)
**File**: `src/features/agents/explorer.ts`
**Depends on**: 6.1
**Parallel group**: C
**Addresses**: AC-6

Add `${Protocol.siblingCommunication(self)}` to the `<protocols>` section in the explorer agent prompt.

Explorer is a prime candidate for broadcasting discoveries (file locations, patterns found).

**Done when**:

- [ ] `Protocol.siblingCommunication(self)` added to protocols section
- [ ] Existing protocols unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add after `Protocol.confidence` in protocols section
- Note: Explorer is a leaf node (no task delegation) but CAN broadcast

---

#### 7.3 Add Sibling Communication to Executor

**Agent**: Baruch (executor)
**File**: `src/features/agents/executor.ts`
**Depends on**: 6.1
**Parallel group**: C
**Addresses**: AC-6

Add `${Protocol.siblingCommunication(self)}` to the `<protocols>` section in the executor agent prompt.

Executor can broadcast warnings about gotchas encountered during implementation.

**Done when**:

- [ ] `Protocol.siblingCommunication(self)` added to protocols section
- [ ] Existing protocols unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add after `Protocol.checkpoint` in protocols section

---

#### 7.4 Add Sibling Communication to Researcher

**Agent**: Baruch (executor)
**File**: `src/features/agents/researcher.ts`
**Depends on**: 6.1
**Parallel group**: C
**Addresses**: AC-6

Add `${Protocol.siblingCommunication(self)}` to the `<protocols>` section in the researcher agent prompt.

Researcher can broadcast external findings that help siblings.

**Done when**:

- [ ] `Protocol.siblingCommunication(self)` added to protocols section
- [ ] Existing protocols unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add after `Protocol.retryStrategy` in protocols section

---

#### 7.5 Add Sibling Communication to Remaining Subagents

**Agent**: Baruch (executor)
**Files**:

- `src/features/agents/architect.ts`
- `src/features/agents/brainstormer.ts`
- `src/features/agents/consultant.ts`
- `src/features/agents/designer.ts`
- `src/features/agents/documenter.ts`
- `src/features/agents/planner.ts`
- `src/features/agents/reviewer.ts`

**Depends on**: 6.1
**Parallel group**: C
**Addresses**: AC-6

Add `${Protocol.siblingCommunication(self)}` to the `<protocols>` section in each subagent prompt.

**Done when**:

- [ ] `Protocol.siblingCommunication(self)` added to all 7 agent files
- [ ] Existing protocols unchanged in each file
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add to `<protocols>` section in each agent
- Note: All subagents get the "sibling" variant of the protocol

---

### Phase 8: Verification (Sequential)

> Final verification after all changes complete

#### 8.1 Run Verification Suite

**Agent**: Baruch (executor)
**File**: N/A (verification only)
**Depends on**: 3.3, 4.1, 5.1, 5.2, 7.1, 7.2, 7.3, 7.4, 7.5

Run verification commands to ensure all changes are valid:

1. `bun run typecheck` - TypeScript compilation
2. `bun run lint` - Code style
3. `bun run build` - Full build
4. `bun run test` - Run tests

**Done when**:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] `bun run test` passes (or no regressions)
- [ ] No regressions in existing functionality

---

#### 8.2 Verify Acceptance Criteria

**Agent**: Elihu (reviewer)
**File**: N/A (review only)
**Depends on**: 8.1

Review implementation against all acceptance criteria from spec v2.1:

**AC-1: Broadcast Delivery**

- [ ] `task_broadcast` delivers to siblings when `target: 'siblings'`
- [ ] `task_broadcast` delivers to children when `target: 'children'`
- [ ] `task_broadcast` delivers to both when `target: 'all'`
- [ ] Message appears in recipient's session history
- [ ] Self is excluded from recipients
- [ ] Return value includes delivery count and target

**AC-2: Broadcast Reading**

- [ ] `task_broadcasts_read` with `source: 'self'` returns broadcasts in current session
- [ ] `task_broadcasts_read` with `source: 'children'` returns broadcasts from child sessions
- [ ] Category filtering works correctly
- [ ] Broadcasts ordered by timestamp (newest first)
- [ ] Limit parameter respected
- [ ] Source indicator included in results

**AC-3: Message Format**

- [ ] Broadcasts use XML format with required attributes
- [ ] Broadcasts parseable by `parseBroadcasts`
- [ ] Messages over 2000 characters rejected with clear error

**AC-4: Loop Prevention**

- [ ] Broadcasts use `noReply: true`
- [ ] Receiving broadcast does not trigger agent response
- [ ] No infinite loops in parallel task scenarios
- [ ] Sibling injection uses `noReply: true`

**AC-5: Error Handling**

- [ ] Non-child sessions get clear error when targeting siblings
- [ ] Orchestrator targeting siblings gets clear error
- [ ] Partial delivery failures reported
- [ ] Deleted sibling sessions skipped gracefully

**AC-6: Agent Integration**

- [ ] All agent prompts include sibling communication protocol
- [ ] Orchestrator can use broadcast tools
- [ ] Subagents can use broadcast tools

**AC-7: Sibling Injection**

- [ ] New tasks receive `<sibling_tasks>` context
- [ ] Existing siblings receive `<new_sibling>` announcement
- [ ] Injection uses `noReply: true`
- [ ] Injection includes task ID, agent name, and title
- [ ] Hook fires on `session.created` event

**AC-8: task_send_message Sibling Support**

- [ ] Validates against both children and siblings
- [ ] Agents can send direct messages to siblings
- [ ] Error message clear when task ID invalid

**AC-9: task_output Sibling Support**

- [ ] Validates against both children and siblings
- [ ] Agents can get sibling task output
- [ ] Error message clear when task ID invalid

**AC-10: task_send_message noReply Option**

- [ ] `noReply: true` injects without triggering response
- [ ] `noReply: false` (default) triggers response as before
- [ ] Uses `synthetic: true` flag when `noReply: true`

**Done when**:

- [ ] All 10 acceptance criteria verified
- [ ] Any issues documented with specific failures
- [ ] Review report created

---

## Testing

### Unit Tests (to be added in future iteration)

- [ ] `formatBroadcastMessage` produces valid XML with all attributes
- [ ] `parseBroadcasts` extracts all broadcasts from messages
- [ ] `parseBroadcasts` handles multiple broadcasts in one message
- [ ] `parseBroadcasts` skips malformed broadcasts
- [ ] `getSiblingSessionsFromChild` handles no-parent case
- [ ] `getSiblingSessionsFromChild` filters out self
- [ ] `getRelatedSessions` combines children and siblings
- [ ] `getChildSessionBroadcasts` aggregates from multiple children

### Integration Tests (manual verification)

- [ ] `task_broadcast` delivers message to sibling sessions
- [ ] `task_broadcast` delivers message to child sessions
- [ ] `task_broadcast` returns correct delivery count
- [ ] `task_broadcast` fails gracefully for non-child sessions targeting siblings
- [ ] `task_broadcasts_read` returns parsed broadcasts from self
- [ ] `task_broadcasts_read` returns parsed broadcasts from children
- [ ] `task_broadcasts_read` filters by category
- [ ] `task_broadcasts_read` respects limit
- [ ] `task_send_message` works for sibling tasks
- [ ] `task_send_message` with `noReply: true` doesn't trigger response
- [ ] `task_output` works for sibling tasks
- [ ] Sibling injection fires on task creation
- [ ] New sibling announcement reaches existing siblings

### E2E Scenarios (manual verification)

- [ ] Orchestrator creates parallel tasks (explorer + executor)
- [ ] Explorer broadcasts discovery
- [ ] Executor reads broadcast and uses information
- [ ] Orchestrator broadcasts to all children
- [ ] Orchestrator reads child broadcasts for status
- [ ] New task receives sibling context on creation
- [ ] Completed siblings receive broadcasts (for resurrection)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Broadcast spam degrades performance | High | Protocol guidance limits what to broadcast |
| Agents ignore broadcasts | Medium | Protocol emphasizes reading at task start |
| Message parsing fails on edge cases | Medium | Robust regex, skip malformed broadcasts |
| Large sibling count causes latency | Medium | Async delivery via `promptAsync` |
| Broadcasts create context bloat | Medium | 2000 char limit, concise message guidance |
| Loop prevention fails | High | `noReply: true` + protocol guidance |
| Sibling injection race condition | Medium | Hook fires on event, not polling |
| Compaction loses broadcast context | Medium | Trust LLM summarization for MVP |

## Checkpoint

**Session**: 2026-01-27T00:00:00Z
**Completed**: None
**In Progress**: None
**Notes**: Plan v2.0 created from spec v2.1. Ready for execution. Key changes from v1.0:

- Added `target` parameter to `task_broadcast` (FR-7)
- Added `source` parameter to `task_broadcasts_read` (FR-8)
- Added sibling injection hook (FR-9, FR-10)
- Added `noReply` parameter to `task_send_message` (FR-13)
- Expanded `task_output` validation for siblings (FR-12)
- Expanded `task_send_message` validation for siblings (FR-11)
- Protocol is now dynamic based on agent type
- All tools remain in `index.ts` (no separate broadcast.ts)
**Blockers**: None
