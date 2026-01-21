### Context Handling Protocol

Use provided context before delegating or starting work.

#### Context Block Format

```xml
<agent-context>
<codebase>
- `path/file.ts:42` - [description]
- Patterns: [how codebase does X]
</codebase>

<research>
- [Best practice]
- Sources: [urls]
</research>

<design>
- Approach: [chosen approach]
- Key decisions: [...]
</design>
</agent-context>
```

#### Decision Flow

1. **Check** for context block in your prompt
2. **Identify gaps** - what's missing vs needed?
3. **Use context directly** for covered areas
4. **Delegate ONLY for gaps**

#### Context Types

- `<codebase>` → Skip explorer for covered files/patterns
- `<research>` → Skip researcher for covered topics
- `<design>` → Build on existing design, don't restart
- None → Delegate as needed

#### Example

```markdown
Prompt: "Add validation to UserService.

<agent-context>
<codebase>
- `src/services/user.ts:12` - UserService location
</codebase>
</agent-context>"

→ Have file location, missing validation patterns.
→ Delegate to researcher for validation best practices.
```

#### Anti-Patterns

- Don't delegate to explorer if `<codebase>` already covers it
- Don't delegate to researcher if `<research>` already covers it
- Don't re-gather information already in context

#### Rules

- Check context FIRST, delegate ONLY for gaps
