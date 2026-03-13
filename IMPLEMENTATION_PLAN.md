# Revised Implementation Plan

## 1 — Scaffolding

### 1.1 Generate addon
Run `php please make:addon mariohamann/statamic-visual-editor` to scaffold the addon structure per [Statamic's addon guide](https://statamic.dev/addons/building-an-addon).

### 1.2 Configure Vite
Set up dual-entry build for `cp.js` and `bridge.js` per [Statamic Vite tooling docs](https://statamic.dev/addons/vite-tooling).

### 1.3 Configure test infrastructure
PHPUnit with Statamic's addon test helpers. Vitest with jsdom for JS.

### 1.4 Tests
- Addon is discoverable via `php artisan statamic:addons:discover`
- ServiceProvider boots without error

---

## 2 — Auto-UUID Fieldtype

### 2.1 `AutoUuidFieldtype`
A minimal custom fieldtype (extending or mimicking `hidden`). Not selectable in the blueprint picker (`$selectable = false`). Renders no UI. `preProcess` generates a UUID when value is null. `process` and `augment` pass through.

### 2.2 Vue component
Renders `<input type="hidden" :value="value" :data-visual-id="value" />`. Emits a UUID on mount if value is empty (for new sets before save).

### 2.3 Tests
- `preProcess` generates UUID when null
- `preProcess` returns existing UUID unchanged
- `process` passes through
- `augment` passes through
- Field is **not** selectable in blueprint picker

---

## 3 — Automatic Blueprint Injection

### 3.1 `EntryBlueprintFound` listener
Listens for `EntryBlueprintFound`. Walks all fields in the blueprint. For every `replicator` or `bard` field, recursively walks all set definitions and appends a `_visual_id` field of type `auto_uuid`.

### 3.2 Recursive injection
Must handle nested Replicators/Bards (a Replicator set containing a Bard containing more sets). Walk the full tree.

### 3.3 Also listen on `GlobalVariablesBlueprintFound`
Globals can also have Replicator/Bard fields that render on the frontend.

### 3.4 Tests
- A blueprint with one Replicator gains `_visual_id` in every set after event
- A blueprint with nested Replicator-in-Bard gains `_visual_id` at every level
- A blueprint with no Replicator/Bard is unchanged
- Existing `_visual_id` fields are not duplicated (idempotent)
- Original YAML on disk is never modified
- Works for `GlobalVariablesBlueprintFound`

---

## 4 — UUID Stamping on Save

### 4.1 `EntrySaving` listener
Walk all Replicator/Bard data in the entry. Any set where `_visual_id` is null or missing gets a UUID stamped before save. This covers entries created before the addon was installed, or sets added via API.

### 4.2 Tests
- New sets get a UUID on save
- Existing sets keep their UUID
- Nested sets all get UUIDs
- Works for GlobalVariables too

---

## 5 — Antlers Tag & Blade Helper

### 5.1 `visual_edit` Antlers tag
Reads `_visual_id` and `type` from scope automatically. `{{ visual_edit:attr }}` returns attribute string. `{{ visual_edit }}...{{ /visual_edit }}` wraps in div. No-op outside Live Preview. Supports explicit overrides.

### 5.2 `visual_edit()` Blade helper
Global function. Returns attribute string during Live Preview. Returns empty string otherwise. Accepts optional UUID + label params.

### 5.3 Tests
- `attr` outputs `data-sid` during Live Preview
- `attr` outputs empty string outside Live Preview
- Auto-reads `_visual_id` from context
- Auto-reads `type` as label
- Explicit params override context
- No-op when no `_visual_id` in scope
- HTML escaping
- Blade helper same coverage

---

## 6 — Bridge Script

### 6.1 Iframe detection + init
Only runs when `window.self !== window.top`.

### 6.2 CSS injection
Hover outline, active outline, label tooltip via `::after`.

### 6.3 Click handler
Capture phase. `closest('[data-sid]')`. Prevents default. Sets `data-sid-active`. Sends `postMessage` to parent.

### 6.4 Hover handler
Sends hover message to parent.

### 6.5 Tests
- No-op outside iframe
- Click sends correct UID
- Child click bubbles correctly
- Non-annotated click ignored
- Single active element
- Styles injected

---

## 7 — CP Script

### 7.1 `findSetByUid(uid)`
Scans `[data-visual-id]` inputs for matching value. Returns `closest('[data-replicator-set], [data-bard-set]')`.

### 7.2 `collectAncestorSets(setEl)`
Iterative `parentElement.closest()`. Returns outermost-first array.

### 7.3 `expandSet(setEl)`
Checks `data-collapsed`. Clicks header toggle.

### 7.4 `highlightSet(setEl)`
Adds outline classes, removes after 2s.

### 7.5 `handleFocus(uid)`
Chains 7.1 → 7.2 → 7.3 → scroll → 7.4.

### 7.6 `handleHover(uid)`
Subtle indicator on matching visible set.

### 7.7 Message listener
Routes messages to focus/hover handlers. Ignores unrelated.

### 7.8 Tests
- Unknown UID returns null
- Correct set found for Replicator / Bard
- Ancestor collection correct at 1/2/3 levels
- Expand clicks toggle when collapsed
- Expand no-ops when not collapsed
- Highlight adds/removes classes
- Focus no-ops for unknown UID
- Unrelated messages ignored

---

## 8 — Service Provider & Middleware

### 8.1 ServiceProvider
Registers fieldtype, tag, Blade helper, event listeners. Loads CP script via `$vite`. Publishes bridge assets. Registers middleware conditionally.

### 8.2 Bridge injection middleware
On `X-Statamic-Live-Preview` responses: injects bridge `<script>` before `</body>`. No-op otherwise. Config toggle to disable.

### 8.3 Settings blueprint
Addon settings via `resources/blueprints/settings.yaml` for any config (e.g. enable/disable, modifier key for clicks).

### 8.4 Tests
- Fieldtype registered
- Tag registered
- Blade helper registered
- Event listeners registered
- CP script loaded
- Middleware injects during Live Preview
- Middleware skips non-Live-Preview
- Middleware handles missing `</body>`
- Middleware respects config toggle

---

## 9 — DOM Selector Validation

### 9.1 Real Statamic 6 install
Create project with nested Replicator + Bard sets.

### 9.2 Verify selectors
- `[data-replicator-set]` exists
- `[data-bard-set]` exists (or document actual)
- `[data-collapsed]` on collapsed sets
- Header toggle button clickable
- `v-show` confirmed (collapsed inputs in DOM)
- Auto-injected `_visual_id` hidden input present with `data-visual-id`

### 9.3 Adjust
Update `SELECTORS` constant if needed. Re-run Phase 7 tests.

---

## 10 — End-to-End Integration

### 10.1 Single set click-to-edit
### 10.2 Multiple sets — correct navigation
### 10.3 3-level nested sets — all ancestors expand
### 10.4 Bard set — expand + scroll
### 10.5 Already-expanded set — scroll + highlight only
### 10.6 Production output — zero footprint (no `data-sid`, no bridge script)
### 10.7 New entry — UUIDs generated on first save without manual intervention

---

## 11 — Documentation

### 11.1 README
Installation (one `composer require`), template annotation (`{{ visual_edit:attr }}`), config options, known limitations.

### 11.2 Screen recording
GIF demonstrating click-to-edit.

### 11.3 Troubleshooting
Bridge not injected, UUIDs not appearing, set not found.

---

## 12 – QA

### 12.1 Implement Bidirectional Clicking and Hovering
Currently it's not working perfectly in both directions. This should be fixed.

### 12.2 Improve Bard UX
Text Nodes in Bards should allow the same behaviour. This will require a different selector and potentially a different approach to expanding/highlighting.

### 12.3 Improve outlines in preview
- We want to use colors from CP in the preview – Maybe this has to be injected by the bridge script.
  - The active color in the preview should be --theme-color-gray-400
  - The hover color should be --theme-color-gray-400
- When moving the mouse in the preview, all areas that are clickable should show the hover outline but dashed. After 1.5 seconds the dashed outline should disappear.
- Only the element that would be focused on click should not be dashed and always stay visible when being hovered === the most inner clickable element with the visual-id that is currently hovered?
