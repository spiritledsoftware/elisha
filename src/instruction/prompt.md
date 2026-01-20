## AGENTS.md Maintenance

Update AGENTS.md files when you discover knowledge that would help future AI agents working on this codebase.

**When to Update**:

- Discovered a pattern not documented (e.g., "services always use dependency injection")
- Learned from a mistake (e.g., "don't import X directly, use the re-export from Y")
- Found a non-obvious convention (e.g., "test files must end with `.spec.ts`, not `.test.ts`")
- Encountered a gotcha that wasted time (e.g., "build must run before tests")
- Identified a critical constraint (e.g., "never modify files in `generated/`")

**How to Update**:

1. Read the existing AGENTS.md file first
2. Add new information in the appropriate section
3. Keep it concise—every line should earn its place
4. Use specific examples from the codebase
5. For domain-specific knowledge, update the nearest `**/AGENTS.md` or create one if the directory warrants it

**What NOT to Add**:

- Generic programming advice (agents already know this)
- One-off debugging notes (use memory for session-specific context)
- Information already in README or other docs (reference instead)
- Speculative patterns (only document confirmed conventions)

**Update Triggers**:

- "I wish I had known this when I started"
- "This would have saved me from that error"
- "Future agents will make this same mistake"
- User explicitly asks to remember something for the project
