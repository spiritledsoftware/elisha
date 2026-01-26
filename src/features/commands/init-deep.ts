import { defineCommand } from '~/command';
import { Prompt } from '~/util/prompt';

export const initDeepCommand = defineCommand({
  id: 'init-deep',
  config: () => {
    return {
      description:
        'Initialize AGENTS.md instructions within the current project',
      template: Prompt.template`
        You are creating AGENTS.md instruction files for a codebase. These files guide AI coding agents to work effectively within this project.

        ## Your Job

        Analyze the codebase and create a hierarchy of AGENTS.md files:

        - \`./AGENTS.md\` — Project-level instructions (always created)
        - \`**/AGENTS.md\` — Domain-specific instructions (created when a directory has unique patterns, conventions, or constraints that differ from the project root)

        ## Process

        ### Phase 1: Codebase Analysis

        Before writing any files, thoroughly explore the codebase:

        1. **Project Structure**

          - Identify the tech stack (languages, frameworks, libraries)
          - Map the directory structure and understand the architecture
          - Find existing documentation (README, CONTRIBUTING, docs/)
          - Locate configuration files (package.json, tsconfig, etc.)

        2. **Code Patterns**

          - Identify naming conventions (files, variables, functions, classes)
          - Find common patterns (error handling, logging, testing)
          - Note import/export conventions
          - Discover architectural patterns (MVC, hexagonal, etc.)

        3. **Domain Boundaries**
          - Identify distinct domains or modules with their own rules
          - Find directories with specialized conventions (e.g., \`tests/\`, \`scripts/\`, \`infra/\`)
          - Note any directories with different tech stacks or paradigms

        ### Phase 2: Instruction Design

        For each AGENTS.md file, determine what an AI agent needs to know:

        **Project-Level (\`./AGENTS.md\`)** should include:

        - Project overview and purpose
        - Tech stack and key dependencies
        - Global coding standards
        - File organization principles
        - Common patterns used throughout
        - Build/test/deploy commands
        - What NOT to do (anti-patterns specific to this project)

        **Domain-Specific (\`**/AGENTS.md\`)** should include:

        - Purpose of this directory/module
        - Domain-specific conventions that differ from root
        - Key files and their roles
        - Patterns unique to this domain
        - Integration points with other modules
        - Domain-specific gotchas or constraints

        ### Phase 3: Write Instructions

        Create AGENTS.md files following these principles:

        #### Content Principles

        1. **Be Specific, Not Generic**

          - ❌ "Follow best practices"
          - ✅ "Use \`asyncHandler\` wrapper for all Express route handlers"

        2. **Show, Don't Just Tell**

          - Include code snippets for patterns
          - Reference actual files as examples: "See \`src/services/user.ts\` for the service pattern"

        3. **Prioritize Actionable Information**

          - Lead with what agents need most often
          - Put critical constraints early (things that break builds, tests, or conventions)

        4. **Be Concise but Complete**
          - Agents have limited context windows
          - Every line should earn its place
          - Use bullet points and tables for scannability

        #### Structure Template

        \`\`\`markdown
        # [Project/Module Name]

        [1-2 sentence description of what this is and its purpose]

        ## Tech Stack

        - [Language/Framework] - [version if relevant]
        - [Key libraries with their purposes]

        ## Project Structure

        [Brief explanation of directory organization]

        ## Code Standards

        ### Naming Conventions

        - Files: [pattern]
        - Functions: [pattern]
        - Classes: [pattern]

        ### Patterns

        [Key patterns with brief code examples]

        ## Commands

        - \`[command]\` - [what it does]

        ## Critical Rules

        - [Things that MUST be followed]
        - [Things that will break if ignored]

        ## Anti-Patterns

        - [What NOT to do and why]
        \`\`\`

        ### Phase 4: Decide on Domain-Specific Files

        Create a domain-specific AGENTS.md ONLY when a directory has:

        | Create AGENTS.md When        | Example                                             |
        | ---------------------------- | --------------------------------------------------- |
        | Different language/framework | \`scripts/\` uses Python while main app is TypeScript |
        | Unique testing patterns      | \`tests/e2e/\` has different setup than unit tests    |
        | Special build/deploy rules   | \`infra/\` has Terraform conventions                  |
        | Domain-specific terminology  | \`packages/billing/\` has payment-specific patterns   |
        | Different code style         | \`legacy/\` follows older conventions                 |
        | Complex internal patterns    | \`packages/core/\` has intricate module system        |

        Do NOT create domain-specific AGENTS.md for:

        - Directories that simply follow project-root conventions
        - Directories with only 1-2 files
        - Directories that are self-explanatory (like \`types/\` or \`constants/\`)

        ## Output Format

        After analysis, create the files using the Write tool. Report what you created:

        \`\`\`
        ## Created AGENTS.md Files

        ### ./AGENTS.md (Project Root)
        - [Brief summary of what's covered]

        ### ./src/tests/AGENTS.md
        - [Why this directory needed its own instructions]
        - [Key points covered]

        ### ./packages/api/AGENTS.md
        - [Why this directory needed its own instructions]
        - [Key points covered]
        \`\`\`

        ## Quality Checklist

        Before finishing, verify each AGENTS.md file:

        - [ ] Contains project/module-specific information (not generic advice)
        - [ ] Includes actual file paths and code examples from this codebase
        - [ ] Covers the most common tasks an agent would perform
        - [ ] Lists critical constraints that could cause failures
        - [ ] Is scannable (headers, bullets, tables)
        - [ ] Doesn't duplicate information from parent AGENTS.md files
        - [ ] Is concise enough to fit in an agent's context window

        ## Anti-Patterns

        - Don't write generic programming advice — agents already know how to code
        - Don't duplicate documentation that exists elsewhere — reference it instead
        - Don't create AGENTS.md for every directory — only where truly needed
        - Don't write novels — agents need scannable, actionable instructions
        - Don't assume the agent knows your project — explain project-specific terms
        - Don't forget to include what NOT to do — anti-patterns prevent mistakes

        ## Rules

        - Always start with thorough codebase exploration before writing
        - Always create \`./AGENTS.md\` at minimum
        - Only create domain-specific files when genuinely needed
        - Reference actual files and patterns from the codebase
        - Keep instructions actionable and specific
        - Include code examples for non-obvious patterns
        - Test your instructions mentally: "Would an AI agent know what to do?"
      `,
    };
  },
});
