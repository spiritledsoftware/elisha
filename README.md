# Elisha

[![npm version](https://img.shields.io/npm/v/@spiritledsoftware/elisha.svg)](https://www.npmjs.com/package/@spiritledsoftware/elisha)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [OpenCode](https://opencode.ai) plugin for advanced AI-driven software development assistance with persistent memory and specialized agent orchestration.

## Installation

Add to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": ["@spiritledsoftware/elisha"]
}
```

Restart OpenCode and you're ready to go. **No additional configuration required**—all agents, MCP servers, and commands work out of the box.

Optionally, pin to a specific version for stability:

```json
{
  "plugin": ["@spiritledsoftware/elisha@0.1.0"]
}
```

OpenCode fetches unpinned plugins from npm on each startup; pinned versions are cached and require a manual version bump to update.

## Features

- **Persistent Memory** - Integrates OpenMemory to maintain context across sessions via automatic `<memory-context>` injection
- **Agent Swarm** - 11 specialized agents for different development tasks with clear separation of concerns
- **Instruction System** - Smart `<instructions-context>` injection to guide agents on project-specific patterns via `AGENTS.md` files
- **MCP Tool Integration** - Pre-configured MCP servers for memory, search, and debugging

## Agents

### Jethro (orchestrator)

Task coordinator that delegates work to specialized agents. Never touches code directly—focuses on breaking down complex requests and routing to the right specialists.

### Caleb (explorer)

Codebase search specialist for finding files and mapping structure. READ-ONLY access. Specify thoroughness: "quick" (1 search), "medium" (2-3 searches), "thorough" (4-6 searches).

### Bezalel (architect)

Solution designer for analyzing requirements and recommending architecture. DESIGN-ONLY, no code. Specify scope: "component", "system", or "strategic".

### Ahithopel (consultant)

Expert consultant for debugging blockers and solving complex problems. ADVISORY-ONLY—provides recommendations and actionable guidance, not code. Use when stuck or need expert evaluation.

### Ezra (planner)

Creates step-by-step implementation plans in `.agent/plans/` and specs in `.agent/specs/`. Specify detail: "outline", "detailed", or "spec".

### Baruch (executor)

Reads plans and writes code. Executes precisely what the plan says. Specify mode: "step" (one task), "phase" (one phase), or "full" (entire plan).

### Oholiab (designer)

Frontend/UX design specialist for implementing visual designs, CSS, and UI layouts. Uses Chrome DevTools for live visual verification. Focuses on CSS/styling—not business logic.

### Berean (researcher)

External research specialist for library docs, API examples, and GitHub code patterns. Specify thoroughness: "quick", "medium", or "thorough".

### Elihu (reviewer)

Code reviewer that analyzes diffs and writes reviews to `.agent/reviews/`. Specify scope: "quick", "standard", or "thorough".

### Luke (documenter)

Documentation writer for creating and updating docs. Specify scope: "file", "module", or "project".

### Jubal (brainstormer)

Creative ideation specialist for generating diverse ideas. Specify mode: "divergent", "convergent", or "wild".

## MCP Servers

Pre-configured MCP servers available to agents:

- **OpenMemory** - Persistent memory management (query, store, reinforce, list, get)
- **Exa** - Advanced web search for research tasks
- **Context7** - Specialized code search and context retrieval
- **Grep.app** - Public repository code search
- **Chrome DevTools** - Browser debugging and inspection

## Commands

### /init-deep

Initialize `AGENTS.md` instructions within the current project. Analyzes the codebase to create a hierarchy of instruction files that guide AI agents on project patterns, conventions, and constraints.

## Configuration

Elisha works with zero configuration, but you can customize behavior in your `opencode.json` if needed.

### Agents

```jsonc
{
  "agent": {
    "Jethro (orchestrator)": {
      "disable": true
      // Other OpenCode agent settings
    }
  }
}
```

Agents will use your `model` and `small_model` settings from OpenCode config appropriately.

### MCP Servers

```jsonc
{
  "mcp": {
    "openmemory": {
      "enabled": false
      // Other OpenCode MCP settings
    }
  }
}
```

## Contributing

This project uses [changesets](https://github.com/changesets/changesets) for version management.

### Making Changes

1. Create a branch for your changes
2. Make your changes
3. Run `bunx @changesets/cli` to create a changeset describing your changes
4. Submit a pull request

### Release Process

When changes are merged to `main`, the release workflow will:

1. Create a "Release" PR that bumps versions based on changesets
2. When the Release PR is merged, packages are automatically published to npm

## License

[MIT](./LICENSE) - Spirit-Led Software LLC

---

_This plugin is designed for use with [OpenCode](https://opencode.ai). It is not affiliated with or endorsed by Anthropic._
