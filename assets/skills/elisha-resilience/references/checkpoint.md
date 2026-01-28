# Checkpoint Protocol

Preserving progress for session continuity and handoff.

## Core Principle

Checkpoints capture the current state of work so that:

1. Progress is not lost when sessions end
2. Future sessions can resume efficiently
3. Handoffs between agents preserve context

## When to Checkpoint

| Situation                     | Action                                   |
| ----------------------------- | ---------------------------------------- |
| Completing a significant task | Write checkpoint with completed status   |
| Stopping mid-task             | Write checkpoint with in-progress status |
| Encountering a blocker        | Write checkpoint with blocker details    |
| Before long-running operation | Write checkpoint in case of timeout      |
| Handing off to another agent  | Include checkpoint in handoff context    |

## Checkpoint Format

```markdown
## Checkpoint

**Session**: [ISO timestamp]
**Completed**: [Tasks done]
**In Progress**: [Current task]
**Notes**: [Context for next session]
**Blockers**: [If any]
```

## Field Descriptions

| Field           | Purpose                     | Example                                           |
| --------------- | --------------------------- | ------------------------------------------------- |
| **Session**     | When checkpoint was created | `2024-01-15T14:30:00Z`                            |
| **Completed**   | Tasks finished this session | "Added user authentication, created login form"   |
| **In Progress** | Current unfinished task     | "Implementing password reset flow"                |
| **Notes**       | Context needed to resume    | "Using SendGrid for emails, see src/lib/email.ts" |
| **Blockers**    | Issues preventing progress  | "Waiting for API credentials from DevOps"         |

## Checkpoint Examples

### Example 1: Successful Progress

```markdown
## Checkpoint

**Session**: 2024-01-15T14:30:00Z
**Completed**:

- Implemented user registration endpoint
- Added input validation with Zod
- Created database migration for users table

**In Progress**: None (phase complete)
**Notes**:

- Registration uses bcrypt for password hashing (cost factor 12)
- Email verification is stubbed, needs SMTP config
- Tests passing: `bun test src/auth`

**Blockers**: None
```

### Example 2: Stopped Mid-Task

```markdown
## Checkpoint

**Session**: 2024-01-15T16:45:00Z
**Completed**:

- Analyzed existing authentication flow
- Identified integration points for OAuth

**In Progress**: Implementing Google OAuth provider
**Notes**:

- Started in `src/auth/providers/google.ts`
- Using `googleapis` package (already installed)
- Need to add callback route at `/api/auth/callback/google`
- Reference: https://developers.google.com/identity/protocols/oauth2

**Blockers**: None (stopping for session end)
```

### Example 3: Blocked Progress

```markdown
## Checkpoint

**Session**: 2024-01-15T18:00:00Z
**Completed**:

- Set up Stripe integration structure
- Created webhook endpoint skeleton

**In Progress**: Implementing payment processing
**Notes**:

- Webhook signature verification implemented
- Product/price IDs need to be configured

**Blockers**:

- Missing Stripe API keys (requested from finance team)
- Cannot test webhooks without `STRIPE_WEBHOOK_SECRET`
- Escalated to Ahithopel for alternative testing approach
```

## Checkpoint Location

Checkpoints should be written to:

| Context                  | Location                                  |
| ------------------------ | ----------------------------------------- |
| Implementation plan      | Append to the plan file                   |
| Standalone task          | Include in task output                    |
| Multi-session work       | Dedicated checkpoint file or plan section |
| Handoff to another agent | Include in CONTEXT section of handoff     |

## Reading Checkpoints

When resuming work:

1. **Find the checkpoint**: Check plan files, previous outputs
2. **Verify state**: Confirm completed items are actually done
3. **Resume from In Progress**: Pick up where previous session stopped
4. **Address blockers**: Check if blockers are resolved before proceeding

## Checkpoint Best Practices

| Practice                     | Reasoning                          |
| ---------------------------- | ---------------------------------- |
| Be specific about file paths | Next session can navigate directly |
| Include command examples     | Reduces ramp-up time               |
| Note non-obvious decisions   | Explains "why" not just "what"     |
| List external dependencies   | Highlights what might have changed |
| Keep notes actionable        | Focus on what to do next           |

## Checkpoint Anti-Patterns

| Anti-Pattern                | Why It's Wrong                         | Correct Approach                  |
| --------------------------- | -------------------------------------- | --------------------------------- |
| Vague completed list        | "Did some work" is not useful          | List specific tasks completed     |
| Missing file paths          | Next session wastes time finding files | Include exact paths               |
| No context for decisions    | "Why" is lost                          | Note reasoning for key choices    |
| Skipping checkpoint on stop | Progress is lost                       | Always checkpoint before stopping |
| Overly detailed notes       | Hard to scan, buries important info    | Keep notes concise and actionable |

## Integration with Plans

For agents that update implementation plans (executor, planner), checkpoints integrate with the plan structure:

```markdown
# Implementation Plan: Feature X

## Tasks

### Phase 1: Setup

- [x] Task 1.1
- [x] Task 1.2
- [ ] Task 1.3 ← In Progress

### Phase 2: Implementation

- [ ] Task 2.1
- [ ] Task 2.2

---

## Checkpoint

**Session**: 2024-01-15T14:30:00Z
**Completed**: Task 1.1, Task 1.2
**In Progress**: Task 1.3 - Adding database indexes
**Notes**: Using partial indexes for performance, see migration file
**Blockers**: None
```

This format allows the plan to serve as both task tracker and session state.
