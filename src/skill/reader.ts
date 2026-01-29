import path from 'node:path';
import fs from 'node:fs';

const SKILLS_DIR = path.join(import.meta.dirname, '..', 'assets', 'skills');

/**
 * Strip YAML frontmatter (---...---) from skill markdown content.
 */
function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n*/, '').trim();
}

/**
 * Read a single skill's SKILL.md content by name.
 * Returns the content with frontmatter stripped, or null if not found.
 */
export async function readSkillContent(skillName: string): Promise<string | null> {
  const skillPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
  try {
    const content = await fs.promises.readFile(skillPath, 'utf-8');
    return stripFrontmatter(content);
  } catch {
    return null;
  }
}

/**
 * Parse a prompt string to extract skill names from the "Load at Session Start" section.
 * Looks for `skill("name")` patterns within that specific section.
 */
export function parseSessionStartSkills(prompt: string): string[] {
  // Match the "Load at Session Start" section up to the next ### or ## heading
  const sectionMatch = prompt.match(/### Load at Session Start[\s\S]*?(?=###\s|## [^#])/);
  if (!sectionMatch) return [];

  const skills: string[] = [];
  const skillPattern = /skill\("([^"]+)"\)/g;
  let match;
  while ((match = skillPattern.exec(sectionMatch[0])) !== null) {
    const name = match[1];
    if (name) skills.push(name);
  }
  return skills;
}

/**
 * Resolve session-start skills from a prompt and return their combined content
 * wrapped in XML tags for clear delineation.
 *
 * This is the key function for ensuring skills are always available in the prompt
 * rather than relying on the LLM to invoke skill() at runtime.
 */
export async function resolveSessionStartSkills(prompt: string): Promise<string> {
  const skillNames = parseSessionStartSkills(prompt);
  if (skillNames.length === 0) return '';

  const sections: string[] = [];
  for (const name of skillNames) {
    const content = await readSkillContent(name);
    if (content) {
      sections.push(`<skill name="${name}">\n${content}\n</skill>`);
    }
  }

  if (sections.length === 0) return '';

  return [
    '<session_skills>',
    'The following skills are pre-loaded for this session. Follow their guidance throughout your work.',
    '',
    ...sections,
    '</session_skills>',
  ].join('\n');
}
