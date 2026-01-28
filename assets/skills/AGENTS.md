# AI Skills

Skills are reusable knowledge modules that agents load on-demand via `skill("skill-name")`. They provide structured guidance for specific tasks without bloating the agent's base prompt.

## Directory Structure

Each skill is a directory containing:

```
{skill-name}/
├── SKILL.md              # Main skill file (required)
└── references/           # Optional supporting docs
    ├── topic-a.md
    └── topic-b.md
```

## SKILL.md Format

Skills use YAML frontmatter followed by markdown content:

```markdown
---
name: skill-name
description: When to load this skill (shown in skill picker)
---

# Skill Title

## Overview

[Brief explanation of what this skill teaches]

## When to Use

[Triggering conditions for loading this skill]

## Quick Reference

[Tables, checklists, or key points for fast lookup]

## Detailed Guidance

[Step-by-step instructions, examples, patterns]

## Common Mistakes

[Anti-patterns and how to avoid them]

## Validation Checklist

[What to verify before marking work complete]
```

## Frontmatter Requirements

| Field         | Required | Purpose                                    |
| ------------- | -------- | ------------------------------------------ |
| `name`        | Yes      | Unique identifier (matches directory name) |
| `description` | Yes      | Helps agents decide when to load the skill |

## Existing Skills

| Skill                  | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `elisha-context`       | Context gathering and AGENTS.md maintenance  |
| `elisha-delegation`    | Task handoffs and parallel work coordination |
| `elisha-communication` | Broadcasting discoveries to sibling tasks    |
| `elisha-quality`       | Self-review and completion verification      |
| `elisha-resilience`    | Error recovery and blocker escalation        |

## Adding a New Skill

1. Create directory: `assets/skills/{skill-name}/`
2. Create `SKILL.md` with frontmatter
3. Optionally add `references/` for detailed topics
4. Run build - skills are auto-copied to `~/.config/opencode/skills/`

## References Pattern

Use references for detailed content that would make the main SKILL.md too long:

```markdown
<!-- In SKILL.md -->

See [references/detailed-topic.md](references/detailed-topic.md) for full examples.
```

Reference files are plain markdown without frontmatter.

## Critical Rules

- **Name must match directory**: `skill-name/SKILL.md` where `name: skill-name`
- **Description is searchable**: Write it for the skill picker
- **Keep SKILL.md scannable**: Use tables, bullets, headers
- **Use references for depth**: Main file is for quick lookup

## Installation

Skills are automatically copied to `~/.config/opencode/skills/` during plugin initialization. The `src/skill/config.ts` handles:

1. Walking the `assets/skills/` directory
2. Comparing content with installed skills
3. Copying changed/new files
4. Updating `.gitignore` in the skills directory

## Anti-Patterns

| Don't Do                         | Do This Instead                          |
| -------------------------------- | ---------------------------------------- |
| Duplicate content between skills | Reference shared content or split skills |
| Make SKILL.md too long           | Use references/ for detailed content     |
| Generic advice in skills         | Project-specific, actionable guidance    |
| Missing frontmatter              | Always include name and description      |
| Mismatched name and directory    | Keep them identical                      |
