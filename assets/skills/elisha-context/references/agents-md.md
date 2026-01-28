# AGENTS.md Maintenance Guidelines

How to maintain AGENTS.md files with discovered knowledge that helps future AI agents.

## Purpose

AGENTS.md files capture project-specific knowledge that helps AI agents work effectively on a codebase. Unlike README files (for humans), AGENTS.md is optimized for AI consumption—concise, specific, and actionable.

## When to Update

Update AGENTS.md when discovering knowledge that would help future agents:

### Update Triggers

| Trigger                         | Example                                               |
| ------------------------------- | ----------------------------------------------------- |
| Discovered undocumented pattern | "Services always use dependency injection"            |
| Learned from a mistake          | "Don't import X directly, use the re-export from Y"   |
| Found non-obvious convention    | "Test files must end with `.spec.ts`, not `.test.ts`" |
| Encountered time-wasting gotcha | "Build must run before tests"                         |
| Identified critical constraint  | "Never modify files in `generated/`"                  |
| User asks to remember something | "Always use pnpm, not npm"                            |

### Mental Triggers

Ask yourself:

- "I wish I had known this when I started"
- "This would have saved me from that error"
- "Future agents will make this same mistake"

If any of these apply, the knowledge belongs in AGENTS.md.

## What NOT to Add

| Don't Add                  | Why                                  | Alternative                    |
| -------------------------- | ------------------------------------ | ------------------------------ |
| Generic programming advice | Agents already know this             | Skip entirely                  |
| One-off debugging notes    | Session-specific, not reusable       | Use memory tools               |
| Info already in README     | Avoid duplication                    | Reference existing docs        |
| Speculative patterns       | Only document confirmed conventions  | Wait until pattern is verified |
| Verbose explanations       | Agents need concise, actionable info | Keep to 1-2 sentences          |

### Examples of What NOT to Add

```markdown
# BAD - Generic advice

- Always write tests for your code
- Use meaningful variable names
- Handle errors appropriately

# BAD - One-off debugging

- Fixed bug in auth.ts by adding null check on line 42

# BAD - Speculative

- Might need to add caching later (not confirmed)

# BAD - Already in README

- Run `npm install` to install dependencies
```

## How to Update

### Step 1: Read Existing AGENTS.md

Always read the existing file first to:

- Understand current structure and sections
- Avoid duplicating existing content
- Match the existing style and tone

### Step 2: Add New Information

Add to the appropriate section, or create a new section if needed:

```markdown
## Patterns

- Services use dependency injection via constructor
- All API responses follow `{ data, error }` pattern

## Gotchas

- Build must run before tests (`bun run build && bun test`)
- Don't import from `~/internal` - use public exports only

## Constraints

- Never modify files in `generated/` - they're auto-generated
- All dates must be ISO 8601 format
```

### Step 3: Keep It Concise

Every line should earn its place:

```markdown
# GOOD - Concise and actionable

- Use `ConfigContext.use()` not direct import

# BAD - Too verbose

- When you need to access the configuration, you should use the
  ConfigContext.use() function instead of importing the config
  directly, because the context pattern ensures proper scoping
  and allows for testing.
```

### Step 4: Use Specific Examples

Include file paths, function names, and concrete examples:

```markdown
# GOOD - Specific

- Test files: `foo.ts` → `foo.test.ts` (not `foo.spec.ts`)
- Path alias: `import { x } from '~/util'` (not `../../../util`)

# BAD - Vague

- Use the right test file naming convention
- Use path aliases for imports
```

## Delegation

If the agent cannot edit AGENTS.md directly:

1. **Delegate to `Luke (documenter)`** - Preferred for documentation updates
2. **Delegate to `Baruch (executor)`** - Alternative if documenter unavailable
3. **Report in output** - If no delegation possible, include the update in final output

### Delegation Template

```markdown
OBJECTIVE: Update AGENTS.md with discovered pattern.
CONTEXT: Found that [specific discovery].
CONSTRAINTS:

- Read existing AGENTS.md first
- Add to appropriate section
- Keep concise (1-2 sentences)
- Use specific examples
  SUCCESS: AGENTS.md updated with new knowledge.
  DEPENDENCIES: None.
```

## AGENTS.md Structure

Typical sections in an AGENTS.md file:

| Section           | Content                                 |
| ----------------- | --------------------------------------- |
| Overview          | Brief project description               |
| Tech Stack        | Languages, frameworks, key dependencies |
| Project Structure | Directory layout and key files          |
| Patterns          | Code patterns and conventions           |
| Commands          | Build, test, lint commands              |
| Naming            | Naming conventions for files, functions |
| Gotchas           | Non-obvious behaviors, common mistakes  |
| Constraints       | Things to never do, critical rules      |

## Quality Checklist

Before adding to AGENTS.md:

- [ ] Is this project-specific (not generic advice)?
- [ ] Is this reusable (not a one-off debugging note)?
- [ ] Is this confirmed (not speculative)?
- [ ] Is this concise (1-2 sentences max)?
- [ ] Does it include specific examples?
- [ ] Is it not already documented elsewhere?
- [ ] Would this help a future agent avoid a mistake?
