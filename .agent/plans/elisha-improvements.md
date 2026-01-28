# Plan: Elisha Plugin Improvements

**Version**: 1.5
**Last Updated**: 2026-01-20T18:15:00Z
**Last Agent**: executor
**Status**: Complete
**Complexity**: Medium
**Tasks**: 15

## Checkpoint

**Session**: 2026-01-20T18:15:00Z
**Completed**: Phase 1, Phase 2, Phase 3, Phase 4
**In Progress**: None
**Notes**: Completed Phase 4 (Verification). All tasks in the plan are now finished. Final verification suite (typecheck, lint, build) passed successfully. Removed an unused import `dedent` in `src/task/tools.ts` found during linting.
**Blockers**: None

## Overview

...

### 3.1 Bash Command Hardening

**File**: `src/permission/defaults.ts`

Expand dangerous command patterns beyond just `rm` to include other destructive commands.

**Changes**:

1. Add deny patterns for:
   - `rm -rf *` (force recursive delete)
   - `chmod 777 *` (insecure permissions)
   - `chown * /` (ownership changes to root)
   - `dd if=* of=/dev/*` (disk operations)
   - `mkfs*` (filesystem formatting)
   - `> /dev/*` (device writes)

**Done when**:

- [x] Additional dangerous patterns are denied
- [x] Existing `rm` patterns are preserved
- [x] TypeScript compiles without errors

**Status**: Complete ✓

---

### 3.2 Fix Explorer Description Duplication

**File**: `src/agent/explorer/index.ts`

Remove the duplicate prefix "An autonomous agent that explores..." from the description.

**Changes**:

1. Update description to remove redundant prefix
2. Keep only the concise description starting with "Codebase search specialist..."

**Done when**:

- [x] Description starts with "Codebase search specialist"
- [x] No duplicate text
- [x] TypeScript compiles without errors

**Status**: Complete ✓

---

### 3.3 Update Root AGENTS.md with Security Section

**File**: `AGENTS.md`

Add a security considerations section to the root AGENTS.md.

**Changes**:

1. Add "## Security Considerations" section after "## Anti-Patterns"
2. Include:
   - Memory poisoning awareness
   - Prompt injection risks from file content
   - Safe file handling patterns
   - Reference to permission system documentation

**Done when**:

- [x] Security section exists in root AGENTS.md
- [x] Covers memory poisoning
- [x] Covers prompt injection
- [x] References permission AGENTS.md

**Status**: Complete ✓

---

## Phase 4: Verification

### 4.1 Run Full Verification Suite

**Commands**:

```bash
bun run typecheck
bun run lint
bun run build
```

**Done when**:

- [x] `bun run typecheck` passes with no errors
- [x] `bun run lint` passes with no errors
- [x] `bun run build` completes successfully

**Status**: Complete ✓

---

## Testing

- [x] Hook isolation: Verify one failing hook doesn't crash others
- [x] Memory validation: Test with suspicious content patterns
- [x] Task results: Verify JSON parsing of task tool outputs
- [x] Concurrency: Verify 6th async task is rejected when 5 are running
- [x] Session cleanup: Verify old sessions are removed after TTL
- [x] API keys: Verify warnings appear when keys are missing

## Risks

| Risk                                  | Mitigation                                                         |
| ------------------------------------- | ------------------------------------------------------------------ |
| Breaking existing task tool consumers | Structured results are JSON-serializable strings                   |
| Memory validation false positives     | Start with conservative patterns, log warnings instead of blocking |
| Session cleanup race conditions       | Use atomic Map operations, cleanup on add not on interval          |
| API key warnings spam                 | Only warn once at setup time, not on every request                 |
