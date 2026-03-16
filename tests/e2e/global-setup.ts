import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(): Promise<void> {
  const snapshotDir = path.resolve(__dirname, 'fixtures/content-snapshot/collections/pages');
  const pagesDir = path.resolve(__dirname, '../../content/collections/pages');

  fs.rmSync(pagesDir, { recursive: true, force: true });
  fs.cpSync(snapshotDir, pagesDir, { recursive: true });

  // Invalidate Statamic's stache so it picks up the reset content
  execSync('php artisan statamic:stache:clear', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
  });
}
