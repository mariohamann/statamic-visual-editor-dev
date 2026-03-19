# Statamic Visual Editor — Development and Demo Repository

Drop a tag on each component and editors always know exactly what they're editing — no matter how deeply nested.

- **Two-way sync** — click or hover in the Live Preview or Control Panel and the other side highlights instantly
- **Auto-expand** — click in the Live Preview and the matching set opens and scrolls into view in the Control Panel
- **Zero production footprint** — annotations and scripts are stripped outside of Live Preview

> [!IMPORTANT]
> **You are in the development and demo repository.** The addon source lives in `addons/mariohamann/statamic-visual-editor/` and is automatically synced to the [installable package repository](https://github.com/mariohamann/statamic-visual-editor) via git subtree. All issues, PRs, and development happen here.

## Demo

https://github.com/user-attachments/assets/97ec557d-2642-4e74-87df-fb365a03154b

## Repository structure

| Path | Purpose |
|---|---|
| `addons/mariohamann/statamic-visual-editor/` | The addon source (PHP, JS, tests) |
| `tests/e2e/` | Playwright E2E tests running against APP_URL defined in `.env` |
| Everything else | A stock Statamic site used solely as a test harness |

## Development

All addon work happens in `addons/mariohamann/statamic-visual-editor/`. See `AGENTS.md` for build steps and the addon's own `README.md` for installation and usage instructions.

### Run

```bash
# 1. Install dependencies
composer install
npm install
cd addons/mariohamann/statamic-visual-editor && npm install
cd ../../..

# 2. Build assets
npm run page:build
npm run build

# 3. Set env
cp .env.example .env

# 4. Serve
php artisan serve
```

### Login

Visit [http://127.0.0.1:8000/cp](http://127.0.0.1:8000/cp) and login with:

```
Email: demo@example.com
Password: password
```

> [!WARNING]
> This is a demo environment. Do not use these credentials in production, and do not deploy this site publicly. Otherwise, generate a fresh APP_KEY and new credentials before deployment.

### Building assets

```bash
# 1. PHP formatting
vendor/bin/pint addons/mariohamann/statamic-visual-editor/src addons/mariohamann/statamic-visual-editor/tests --format agent

# 2. Build JS
cd addons/mariohamann/statamic-visual-editor && npm run build

# 3. Publish to public/
php artisan vendor:publish --provider="MarioHamann\StatamicVisualEditor\ServiceProvider" --force

# 4. PHP tests
cd addons/mariohamann/statamic-visual-editor && vendor/bin/phpunit

# 5. E2E tests (requires site running)
npx playwright test
```

## Publishing workflow

Packagist does not support subdirectory publishing, so the addon is maintained here and synced to its own standalone repository via **git subtree**. A CI action runs on every push to `main`:

```bash
git subtree split --prefix=addons/mariohamann/statamic-visual-editor -b addon-split
git push git@github.com:mariohamann/statamic-visual-editor.git addon-split:main --force
```

Packagist points at the standalone repository and picks up new releases automatically via its GitHub webhook.
