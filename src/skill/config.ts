import path from 'node:path';
import fs from 'node:fs';
import { getOpencodeConfigDir } from '~/utils';

async function walkDir(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function walk(currentDir: string, prefix = '') {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
      } else {
        files[relativePath] = await fs.promises.readFile(fullPath, 'utf-8');
      }
    }
  }

  await walk(dir);
  return files;
}

export const setupSkillConfig = async () => {
  const elishaSkillsDir = path.join(import.meta.dirname, '..', 'assets', 'skills');
  const opencodeSkillsDir = path.join(getOpencodeConfigDir(), 'skills');
  const opencodeSkillsGitignorePath = path.join(opencodeSkillsDir, '.gitignore');

  const skillFiles = await walkDir(elishaSkillsDir);
  for (const [relativePath, contents] of Object.entries(skillFiles)) {
    const fullPath = path.join(opencodeSkillsDir, relativePath);

    // Check if file exists and content matches
    try {
      const existingContent = await fs.promises.readFile(fullPath, 'utf-8');
      if (existingContent === contents) {
        continue; // Skip writing - content is identical
      }
    } catch {
      // File doesn't exist, need to write it
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, contents);
  }

  // gitignore all the top level skill directories (preserving existing entries)
  const topLevelDirs = new Set(Object.keys(skillFiles).map((p) => p.split('/')[0]));
  const skillEntries = Array.from(topLevelDirs).map((dir) => `/${dir}/`);

  let existingContent = '';
  try {
    existingContent = await fs.promises.readFile(opencodeSkillsGitignorePath, 'utf-8');
  } catch {
    // File doesn't exist yet, will create with skill entries
  }

  const existingEntries = new Set(
    existingContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );

  const newEntries = skillEntries.filter((entry) => !existingEntries.has(entry));

  if (newEntries.length > 0) {
    const updatedContent = existingContent.trimEnd()
      ? `${existingContent.trimEnd()}\n${newEntries.join('\n')}\n`
      : `${newEntries.join('\n')}\n`;
    await fs.promises.writeFile(opencodeSkillsGitignorePath, updatedContent);
  }
};
