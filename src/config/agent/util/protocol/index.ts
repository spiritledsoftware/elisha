import CONTEXT_HANDLING from './context-handling.md';
import ERROR_HANDLING from './error-handling.md';
import ESCALATION from './escalation.md';
import PLAN_VERSIONING from './plan-versioning.md';

const PROTOCOLS: Record<string, string> = {
  'context-handling': CONTEXT_HANDLING,
  'error-handling': ERROR_HANDLING,
  escalation: ESCALATION,
  'plan-versioning': PLAN_VERSIONING,
};

/**
 * Expands protocol references in a prompt string.
 * Replaces mustache-style {{protocol:name}} with the full protocol content.
 */
export function expandProtocols(prompt: string): string {
  return prompt.replace(/\{\{protocol:([a-z-]+)\}\}/g, (_, name) => {
    const content = PROTOCOLS[name];
    if (!content) {
      throw new Error(`Unknown protocol: ${name}`);
    }
    return `\n\n---\n${content}\n---\n`;
  });
}
