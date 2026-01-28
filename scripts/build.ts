import fs from 'node:fs';
import path from 'node:path';

const isWatch = process.argv.includes('--watch');

async function build(): Promise<boolean> {
  const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist',
    target: 'bun',
    minify: true,
    sourcemap: 'linked',
    loader: {
      '.md': 'text',
    },
  });

  if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
      console.error(log);
    }
    return false;
  }

  // Copy assets
  const srcAssets = path.join(import.meta.dirname, '..', 'assets');
  const destAssets = path.join(import.meta.dirname, '..', 'dist', 'assets');
  await fs.promises.cp(srcAssets, destAssets, { recursive: true });
  console.log('Copied assets/ to dist/assets/');

  console.log('Build completed successfully');
  return true;
}

// Initial build
const success = await build();

if (!isWatch) {
  // Exit with appropriate code in non-watch mode
  if (!success) {
    process.exit(1);
  }
} else {
  console.log('\nWatching for changes in src/ and assets/...');

  let timeout: Timer | null = null;

  const rebuild = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(async () => {
      console.log('\nRebuilding...');
      await build();
      console.log('Watching for changes...\n');
    }, 100);
  };

  fs.watch('./src', { recursive: true }, rebuild);
  fs.watch('./assets', { recursive: true }, rebuild);
}
