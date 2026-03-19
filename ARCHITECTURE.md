# Statamic Visual Editor — Architecture

## Main Flow

```
Blueprint loads
  → InjectVisualIdIntoBlueprint injects hidden _visual_id (auto_uuid) into every Replicator/Bard/Grid set

CP form renders
  → AutoUuidFieldtype generates a fresh in-memory UUID per set (never persisted)
  → UUID lives in Vue form state; CP renders a hidden <input data-visual-id="{uuid}"> per set

Live Preview iframe renders
  → InjectBridgeScript middleware injects bridge.js into the iframe's </body>
  → {{ visual_edit }} / Blade equivalent reads the in-memory UUID and outputs data-sid="{uuid}"
  → Both sides share the same UUID because they share the same form state

User clicks/hovers in preview
  → bridge.js sends postMessage {type: 'click'|'hover', uid|field, afterSetUid?} to CP
  → cp.js receives message, expands collapsed sets, switches tabs if needed, scrolls & highlights

User clicks/hovers in CP
  → cp.js sends postMessage {type: 'focus'|'hover', uid|field} to preview iframe
  → bridge.js receives message and applies outline to the matching annotated element

Entry/Globals saved
  → StripVisualIds listener removes all _visual_id keys before data is written to YAML/JSON
```

## Key Files

| File | Purpose |
|------|---------|
| `src/ServiceProvider.php` | Registers middleware, tags, listeners, Vite config |
| `src/Http/Middleware/InjectBridgeScript.php` | Injects bridge.js into iframe HTML |
| `src/Tags/VisualEdit.php` | `{{ visual_edit }}` Antlers tag — outputs data-sid/data-sid-field attributes |
| `src/Listeners/InjectVisualIdIntoBlueprint.php` | Injects `_visual_id` field into blueprint sets at load time |
| `src/Listeners/StripVisualIds.php` | Strips `_visual_id` keys from content before save |
| `src/Fieldtypes/AutoUuidFieldtype.php` | Generates ephemeral UUID per set via `preProcess()` |
| `resources/js/bridge.js` | iframe-side: click/hover detection, postMessage send/receive, outline rendering |
| `resources/js/cp.js` | CP-side: postMessage routing, set expand/scroll/highlight, tab switching |
| `resources/js/addon.js` | Registers Vue component, calls `initCp()` |

## Notable Design Decisions

- **Ephemeral UUIDs**: UUIDs are never saved to content files. They are generated fresh on every CP form load and stripped on every save. This keeps content files clean with zero footprint.
- **Bard text targeting**: Plain text between Bard sets is targeted using `{uid, afterSetUid}` — the parent set UUID plus the preceding set node UUID — to scroll precisely without a double-jump.
- **Tab switching**: Inactive tab panels are activated by walking the Vue component parent chain to call Statamic's `PublishTabs.setActive(handle)` directly, since reka-ui triggers don't respond to programmatic clicks.
- **Non-bubbling expand click**: Programmatic set expansion uses `dispatchEvent(new MouseEvent('click', { bubbles: false }))` to trigger Vue's toggle without firing the document-level click listener that would send a spurious focus message back to the preview.
- **Grid rows**: Statamic provides no native `data-grid-row` attribute; `stampGridRows()` in cp.js stamps it structurally by detecting ancestor elements whose `<header>` contains a drag handle.

## E2E Tests

Playwright tests in `tests/e2e/` cover: set/field/text-node click-to-focus, CP→preview hover sync, tab switching, Bard toolbar scroll offsets, stale-focus cleanup, Grid rows, directional pulse, long-form content.
