---
"@spiritledsoftware/elisha": minor
---

Improve agent descriptions and streamline prompts for better delegation

- Enhanced all agent descriptions with "Use when:" guidance to help orchestrator make better delegation decisions
- Added description to compaction agent (was previously missing)
- Streamlined agent prompts by extracting shared protocols into reusable templates
- Removed tester agent (consolidated into executor/reviewer workflows)
- Refactored hook files from plural to singular naming convention (hooks.ts → hook.ts)
- Consolidated task tools into single file with types
- Simplified protocol templates for context-handling, error-handling, escalation, and plan-versioning
