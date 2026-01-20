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
- **Agent Swarm** - 10 specialized agents for different development tasks with clear separation of concerns
- **MCP Tool Integration** - Pre-configured MCP servers for memory, search, and debugging
- **Custom Commands** - Memory initialization command for project setup

## Agents

### orchestrator

Task coordinator that delegates work to specialized agents. Never touches code directly—focuses on breaking down complex requests and routing to the right specialists.

### explorer

Codebase search specialist for finding files and mapping structure. READ-ONLY access. Specify thoroughness: "quick" (1 search), "medium" (2-3 searches), "thorough" (4-6 searches).

### architect

Solution designer for analyzing requirements and recommending architecture. DESIGN-ONLY, no code. Specify scope: "component", "system", or "strategic".

### planner

Creates step-by-step implementation plans in `.agent/plans/` and specs in `.agent/specs/`. Specify detail: "outline", "detailed", or "spec".

### executor

Reads plans and writes code. Executes precisely what the plan says. Specify mode: "step" (one task), "phase" (one phase), or "full" (entire plan).

### researcher

External research specialist for library docs, API examples, and GitHub code patterns. Specify thoroughness: "quick", "medium", or "thorough".

### reviewer

Code reviewer that analyzes diffs and writes reviews to `.agent/reviews/`. Specify scope: "quick", "standard", or "thorough".

### tester

Test specialist for running tests and analyzing failures. Specify mode: "run", "analyze", or "suggest".

### documenter

Documentation writer for creating and updating docs. Specify scope: "file", "module", or "project".

### brainstormer

Creative ideation specialist for generating diverse ideas. Specify mode: "divergent", "convergent", or "wild".

## MCP Servers

Pre-configured MCP servers available to agents:

- **OpenMemory** - Persistent memory management (query, store, reinforce, list, get)
- **Exa** - Advanced web search for research tasks
- **Context7** - Specialized code search and context retrieval
- **Grep.app** - Public repository code search
- **Chrome DevTools** - Browser debugging and inspection

## Commands

### /openmemory-init

Initialize OpenMemory with structured memories for the current project. Sets up the memory context for persistent session awareness.

## Configuration

Elisha works with zero configuration, but you can customize behavior in your `opencode.json` if needed.

### Agents

```json
{
  "agent": {
    "orchestrator": {
      "disable": true
      // Other OpenCode agent settings
    }
  }
}
```

Agents will use your `model` and `small_model` settings from OpenCode config appropriately.

### MCP Servers

```json
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
