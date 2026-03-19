# Statamic Visual Editor — Development Repository

This is the **development repository** for the [Statamic Visual Editor](https://github.com/mariohamann/statamic-visual-editor) addon. It embeds the addon inside a complete Statamic project so that E2E tests can run against a real, fully functional site.

## Demo

<video src="https://github.com/user-attachments/assets/97ec557d-2642-4e74-87df-fb365a03154b"></video>

## Repository structure

| Path | Purpose |
|---|---|
| `addons/mariohamann/statamic-visual-editor/` | The addon source (PHP, JS, tests) |
| `tests/e2e/` | Playwright E2E tests running against APP_URL defined in `.env` |
| Everything else | A stock Statamic site used solely as a test harness |

## Publishing workflow

Packagist does not support subdirectory publishing, so the addon is maintained here and synced to its own standalone repository via **git subtree**. A CI action runs on every push to `main`:

```bash
git subtree split --prefix=addons/mariohamann/statamic-visual-editor -b addon-split
git push git@github.com:mariohamann/statamic-visual-editor.git addon-split:main --force
```

Packagist points at the standalone repository and picks up new releases automatically via its GitHub webhook.

## Development

All addon work happens in `addons/mariohamann/statamic-visual-editor/`. See `AGENTS.md` for build steps and the addon's own `README.md` for installation and usage instructions.
