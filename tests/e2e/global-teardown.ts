import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripVisualIdsFromDir(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      stripVisualIdsFromDir(fullPath);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.yaml')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const stripped = content.replace(/^[ \t]*_visual_id:.*\r?\n/gm, '');

      if (stripped !== content) {
        fs.writeFileSync(fullPath, stripped, 'utf-8');
      }
    }
  }
}

export default async function globalTeardown(): Promise<void> {
  const contentDir = path.resolve(__dirname, '../../content');

  stripVisualIdsFromDir(contentDir);

  execSync('php artisan statamic:stache:clear', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
  });
}
