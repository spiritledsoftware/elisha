# Retry Strategy Protocol

Structured approach to handling operation failures with appropriate recovery actions.

## Core Principle

When an operation fails, the agent should:

1. Identify the failure type
2. Apply the appropriate first action
3. If still failing, apply the fallback action
4. Report results with full context

**Retry limit**: 2 attempts per operation (initial + 1 retry)

## Failure Types and Actions

| Failure Type    | Symptoms                             | First Action                     | Fallback Action                        |
| --------------- | ------------------------------------ | -------------------------------- | -------------------------------------- |
| **Not found**   | File/resource doesn't exist at path  | Broaden search, try variations   | Report "not found" with what was tried |
| **Permission**  | Access denied, unauthorized          | Check path/credentials           | Report blocker, suggest resolution     |
| **Timeout**     | Operation exceeded time limit        | Reduce scope or break into parts | Report partial progress                |
| **Parse error** | Invalid format, unexpected structure | Try alternate format             | Report with raw data                   |

## Detailed Recovery Patterns

### Not Found Errors

**Symptoms:**

- "File not found"
- "No such file or directory"
- "Resource does not exist"
- Empty search results

**First Action - Broaden Search:**

```
# Original attempt
Read: src/config/database.json

# Broadened search
Glob: **/database.json
Glob: **/database.{json,yaml,yml}
Glob: **/*config*
```

**Variations to try:**

- Different file extensions (.json, .yaml, .yml, .toml)
- Different naming conventions (database, db, Database, DB)
- Different directory locations (src/, config/, root)
- Partial name matches (_database_, _db_)

**Fallback - Report with context:**

```markdown
## Not Found Report

**Searched for**: Database configuration file
**Paths tried**:

- src/config/database.json
- \*\*/database.json
- \*\*/database.{json,yaml,yml}
- \**/*config\*

**Result**: No matching files found
**Suggestion**: Configuration may use environment variables or different naming
```

### Permission Errors

**Symptoms:**

- "Permission denied"
- "Access denied"
- "Unauthorized"
- "Forbidden"

**First Action - Verify access:**

1. Check if path is correct (typos, wrong directory)
2. Verify credentials/tokens are valid
3. Check if resource requires authentication
4. Confirm scope/permissions are sufficient

**Fallback - Report blocker:**

```markdown
## Permission Blocker

**Operation**: Write to /etc/config
**Error**: Permission denied
**Checked**:

- Path is correct
- User has read access but not write

**Suggested resolution**:

- Run with elevated permissions
- Use alternative writable location
- Request access from administrator
```

### Timeout Errors

**Symptoms:**

- "Operation timed out"
- "Request timeout"
- "Exceeded time limit"
- Long-running operation with no response

**First Action - Reduce scope:**

```
# Original: Process all files
Process: src/**/*.ts (500 files)

# Reduced scope: Process in batches
Process: src/components/**/*.ts (50 files)
Process: src/utils/**/*.ts (30 files)
# ... continue in batches
```

**Breaking strategies:**

- Process fewer files per operation
- Limit search depth
- Add pagination/batching
- Focus on most relevant subset first

**Fallback - Report partial progress:**

```markdown
## Partial Progress Report

**Operation**: Analyze all TypeScript files
**Completed**: 150/500 files (30%)
**Timeout at**: src/features/auth/
**Partial findings**:

- [Results from completed portion]

**Recommendation**: Continue from src/features/auth/ in next session
```

### Parse Errors

**Symptoms:**

- "Invalid JSON"
- "Unexpected token"
- "Failed to parse"
- "Malformed input"

**First Action - Try alternate format:**

```
# Original: Parse as JSON
Parse: response.json → Failed

# Alternate: Try as YAML
Parse: response.yaml → Success

# Or: Request different format
API call with Accept: application/yaml
```

**Format alternatives:**

- JSON ↔ YAML
- XML ↔ JSON
- Structured ↔ Plain text
- Minified ↔ Pretty-printed

**Fallback - Report with raw data:**

```markdown
## Parse Error Report

**Attempted to parse**: API response as JSON
**Error**: Unexpected token at position 0
**Raw data** (first 500 chars):
```

<!DOCTYPE html>...

```

**Analysis**: Server returned HTML error page instead of JSON
**Suggestion**: Check API endpoint URL and authentication
```

## Reporting Requirements

Every failure report must include:

1. **What failed**: The specific operation that failed
2. **What was tried**: All approaches attempted
3. **What worked** (if anything): Partial successes
4. **Suggestions**: Possible resolutions or next steps

## Anti-Patterns

| Anti-Pattern                 | Why It's Wrong                   | Correct Approach                     |
| ---------------------------- | -------------------------------- | ------------------------------------ |
| Retry same action repeatedly | Won't produce different result   | Vary approach on each retry          |
| Retry more than 2 times      | Wastes effort, delays escalation | Escalate after 2 failures            |
| Silent failure               | Loses context, blocks progress   | Always report with details           |
| Immediate escalation         | Misses easy fixes                | Try at least one alternative first   |
| Vague error reports          | Doesn't help resolution          | Include specific details and context |
