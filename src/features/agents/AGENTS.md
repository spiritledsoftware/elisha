# Agent Definitions

This directory contains the 11 specialized AI agents for the Elisha swarm. Each agent has a TypeScript definition file and a markdown prompt file.

## File Structure

Each agent requires two files:

| File               | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `{name}.ts`        | Agent configuration with `defineAgent()` |
| `{name}.prompt.md` | Markdown prompt imported as text         |
| `index.ts`         | Exports `elishaAgents` array             |

## Agent Definition Pattern

```typescript
import { defineAgent } from '~/agent';
import { ConfigContext } from '~/context';
import prompt from './{name}.prompt.md';

export const {name}Agent = defineAgent({
  id: 'DisplayName (role)',           // Unique ID shown to users
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,                   // Show in agent list
      mode: 'all',                     // 'all' | 'subagent' | 'primary'
      model: config.model,             // Use global model config
      temperature: 0.5,                // Agent-specific temperature
      permission: {                    // Tool permissions
        webfetch: 'deny',
        websearch: 'deny',
      },
      description: 'Short description for delegation',
    };
  },
  prompt,                              // Imported from .prompt.md
});
```

## Critical Rules

### Naming

- **ID format**: `{BiblicalName} ({role})` - e.g., `Baruch (executor)`
- **File naming**: lowercase role - e.g., `executor.ts`, `executor.prompt.md`
- **Export naming**: `{role}Agent` - e.g., `executorAgent`

### Permissions

| Permission     | Agents That Get It                            |
| -------------- | --------------------------------------------- |
| `edit: allow`  | executor, documenter                          |
| `edit: deny`   | orchestrator, architect, consultant, reviewer |
| MCP tools      | Set per-agent based on role needs             |
| `task*: allow` | All agents that can delegate                  |

### Mode Selection

| Mode       | When to Use                                   |
| ---------- | --------------------------------------------- |
| `primary`  | Top-level agent (orchestrator)                |
| `subagent` | Only used via delegation, not user-selectable |
| `all`      | Both user-selectable and delegatable          |

### Prompt Files (.prompt.md)

Structure every prompt with:

1. **Header** - Agent name and one-line description
2. **Skills section** - Load at Session Start + Load Before Actions table
3. **Workflow** - Step-by-step process
4. **Instructions** - Numbered action list
5. **Constraints** - MUST/MUST NOT rules
6. **Output format** - Expected response structure

````markdown
# AgentName (role)

You are AgentName, the [role description].
[One-line purpose statement.]

## Skills

### Load at Session Start

- `skill("elisha-context")` - Required for context gathering

### Load Before Actions

| Before This Action     | Load This Skill              |
| ---------------------- | ---------------------------- |
| Marking work complete  | `skill("elisha-quality")`    |
| Encountering a blocker | `skill("elisha-resilience")` |

## Workflow

### 1. First Step

- Details

## Instructions

1. **Action one** - Explanation
2. **Action two** - Explanation

## Constraints

- MUST do X
- MUST NOT do Y
- NEVER do Z

## Output format

```markdown
## Output Header

**Field**: value
```
````

````

## Adding a New Agent

1. Create `{name}.ts` following the pattern above
2. Create `{name}.prompt.md` with proper structure
3. Add to `index.ts`:
   ```typescript
   import { newAgent } from './new';

   export const elishaAgents = [
     // ... existing agents
     newAgent,
   ];
````

4. Run `bun run typecheck` to validate

## Existing Agents

| Agent                    | Role        | Mode     | Key Permissions            |
| ------------------------ | ----------- | -------- | -------------------------- |
| `Jethro (orchestrator)`  | Coordinator | all      | Delegates only, no edit    |
| `Caleb (explorer)`       | Search      | subagent | Read-only, glob, grep      |
| `Bezalel (architect)`    | Design      | subagent | No edit, no implementation |
| `Ahithopel (consultant)` | Advisory    | subagent | No edit, advisory only     |
| `Ezra (planner)`         | Planning    | subagent | Creates .agent/plans/      |
| `Baruch (executor)`      | Code        | all      | Full edit access           |
| `Oholiab (designer)`     | Frontend    | subagent | Edit, chrome-devtools MCP  |
| `Berean (researcher)`    | Research    | subagent | Web search, webfetch       |
| `Elihu (reviewer)`       | Review      | subagent | Read-only, writes reviews  |
| `Luke (documenter)`      | Docs        | subagent | Edit access for docs       |
| `Jubal (brainstormer)`   | Ideation    | subagent | No edit, creative output   |

## Anti-Patterns

| Don't Do                          | Do This Instead                        |
| --------------------------------- | -------------------------------------- |
| Put prompt directly in `.ts` file | Use `.prompt.md` and import            |
| Use generic description           | Be specific about role and limitations |
| Give all permissions              | Restrict to role needs                 |
| Skip skill loading in prompts     | Always include Skills section          |
| Hardcode model in config          | Use `config.model` from ConfigContext  |
