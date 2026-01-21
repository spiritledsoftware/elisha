import CONTEXT_HANDLING from './context-handling.md';
import DELEGATION from './delegation.md';
import ERROR_HANDLING from './error-handling.md';
import ESCALATION from './escalation.md';
import PLAN_VERSIONING from './plan-versioning.md';

const PROTOCOLS: Record<string, string> = {
  delegation: DELEGATION,
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
  return prompt
    .replace(/\{\{protocols:([a-z-]+)\}\}/g, (_, name) => {
      const content = PROTOCOLS[name];
      if (!content) {
        throw new Error(`Unknown protocol: ${name}`);
      }
      return `\n\n${content}\n\n`;
    })
    .replace(/\{\{protocols\}\}/g, (_) => {
      const allProtocols = Object.values(PROTOCOLS).join('\n\n');
      return `\n\n${allProtocols}\n\n`;
    });
}
