# Elisha

[![npm version](https://img.shields.io/npm/v/@spiritledsoftware/elisha.svg)](https://www.npmjs.com/package/@spiritledsoftware/elisha)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An OpenCode plugin for advanced AI-driven software development assistance.

## Installation

```bash
bun add @spiritledsoftware/elisha
```

Or with npm:

```bash
npm install @spiritledsoftware/elisha
```

## Usage

Add the plugin to your OpenCode configuration:

```typescript
import { elisha } from "@spiritledsoftware/elisha";

// Configure OpenCode with the Elisha plugin
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
