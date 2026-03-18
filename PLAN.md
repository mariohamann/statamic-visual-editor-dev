# Plan: Addon Critical Review & Improvement

Comprehensive improvement plan for statamic-visual-editor addon, covering code quality, fragility, security, and test coverage.

## TL;DR

The addon's architecture is solid and well-documented. The main concerns are: dead code that should be removed, duplicated traversal logic between two listeners, hardcoded animation timings, postMessage wildcard origins, overly broad exception handling, and several test coverage gaps. The Vue private API usage in `switchToContainingTab()` is the most fragile part but is accepted as manageable risk.

---

## Phase 1: Dead Code & Simplification

1. **Remove `StatamicVisualEditor` fieldtype (PHP + Vue)** — `src/Fieldtypes/StatamicVisualEditor.php` is a scaffolded pass-through never registered in `ServiceProvider`. `resources/js/components/fieldtypes/StatamicVisualEditor.vue` is imported nowhere. Remove both files.

2. **Clean up `AutoUuidFieldtype`** — Remove the unnecessary `augment()` and `process()` pass-through methods. Statamic's base `Fieldtype` already provides these defaults. Add return type hints to `preProcess()`.

3. **Remove `StatamicVisualEditor.vue` registration** — Confirm it's not registered in `addon.js` (it isn't), then delete the file.

**Relevant files:**
- `addons/mariohamann/statamic-visual-editor/src/Fieldtypes/StatamicVisualEditor.php` — delete entirely
- `addons/mariohamann/statamic-visual-editor/resources/js/components/fieldtypes/StatamicVisualEditor.vue` — delete entirely
- `addons/mariohamann/statamic-visual-editor/src/Fieldtypes/AutoUuidFieldtype.php` — remove `augment()` and `process()`, add type hints

---

## Phase 2: DRY & Maintainability (PHP)

4. **Extract shared set-format detection** — Both `InjectVisualIdIntoBlueprint` and `StampVisualIds` independently detect grouped vs flat set formats and iterate them. Extract a shared trait or helper (`ReplicatorSetFormat`) with a method like `eachSetFields(array $sets, callable $callback)` that handles both formats. This eliminates the most significant DRY violation.

5. **Narrow the exception handling in `VisualEdit::resolveFieldLabel()`** — Replace `catch (\Throwable)` with specific exception types (e.g. `\InvalidArgumentException`, `\BadMethodCallException`). Add `Log::debug()` for caught exceptions to aid debugging. Current code silently swallows all errors including OOM/programming bugs.

6. **Add return type hints** to all public/private methods in:
   - `VisualEdit.php` — `resolveLabel(): string`, `resolveFieldLabel(): string`, `resolveType(): string`, `buildFieldAttr(): string`, `buildAttr(): string`
   - `AutoUuidFieldtype.php` — `preProcess(mixed $data): string`

7. **Improve `InjectBridgeScript` robustness:**
   - Use `str_replace` only on the *last* occurrence of `</body>` (use `strrpos` + `substr_replace`) 
   - Add `json_decode` error check in `resolveBridgeUrl()`
   - Guard against `getContent()` returning `false`

---

## Phase 3: JavaScript Improvements

8. **Extract shared constants** — `HOVER_CLEAR_DELAY`, `HIGHLIGHT_DURATION`, `300` (collapse settle time), outline dimensions are scattered across `bridge.js` and `cp.js`. Create a shared constants block or at minimum document each magic number with a named constant at the top of each file. *Note: bridge.js and cp.js are separate bundles, so true sharing requires a shared module imported by both.*

9. **Add `console.warn` for debugging** — In `cp.js`, when `findSetByUid()` returns null, log a warning. Same for `handleFieldFocus()` when field element not found. Currently all failures are completely silent.

10. **Specify postMessage origin** — In `bridge.js`, change `win.top.postMessage(message, '*')` to `win.top.postMessage(message, window.location.origin)` where same-origin applies. In `cp.js`, `sendToPreview` can keep `'*'` since the iframe may be on a different origin, but add a comment explaining why. *Low practical risk since admin-only, but follows best practices.*

11. **Replace hardcoded 300ms animation delays** — In `cp.js`, the 300ms `setTimeout` for collapse settling is a maintenance hazard. Extract to a named constant `COLLAPSE_SETTLE_MS = 300` with a comment explaining the coupling to CSS transition duration. Consider using `requestAnimationFrame` + `transitionend` listener with a timeout fallback for more resilience.

12. **Deduplicate field path normalization** — Both `bridge.js` and `cp.js` have `findFieldElement()` with slightly different implementations. The bridge does a full DOM scan while CP uses `getElementById`. Since they run in different contexts (iframe vs CP), they can't share code, but the naming and approach should be consistent. Add comments cross-referencing each other.

---

## Phase 4: Security Hardening

13. **postMessage origin validation** — In both `bridge.js` and `cp.js`, the `message` event handler already filters on `data.source === 'statamic-visual-editor'`. Add an origin check on the receiving end: verify `event.origin` matches the expected CP or preview origin. This prevents cross-site message spoofing.

14. **CSS `attr()` safety note** — The `content: attr(data-sid-label)` in bridge.js is safe because Blade/Antlers auto-escape output. Document this assumption in a code comment so future developers don't bypass the escaping.

---

## Phase 5: Test Coverage

15. **Add unit tests for edge cases:**
    - `InjectBridgeScript`: non-HTML response (JSON body), case-insensitive `</BODY>`, multiple `</body>` tags
    - `InjectVisualIdIntoBlueprint`: flat set format (non-grouped Replicator), circular fieldset reference (if possible)
    - `StampVisualIds`: deeply nested Bard→Replicator→Bard, non-replicator/bard/grid fields remain unchanged
    - `VisualEdit`: empty field path, dot-notation with 3+ segments, malformed UUID

16. **Add E2E tests for missing scenarios:**
    - Consecutive Bard sets with no text between them
    - Text node at the END of Bard (last group after all sets)
    - `enabled: false` config toggle
    - Rapid click spam (debounce/dedup verification)

17. **Strengthen `ServiceProviderTest`:**
    - Verify listener classes, not just "not empty" — check actual class names in the listeners array
    - Remove or add substance to `test_service_provider_boots_without_error()` (currently a no-op)

---

## Verification

1. Run `vendor/bin/pint addons/mariohamann/statamic-visual-editor/src addons/mariohamann/statamic-visual-editor/tests --format agent` after PHP changes
2. Run `cd addons/mariohamann/statamic-visual-editor && npm run build` after JS changes
3. Run `php artisan vendor:publish --provider="Mariohamann\StatamicVisualEditor\ServiceProvider" --force` after JS build
4. Run `php artisan test --compact` for unit/feature tests
5. Run `npx playwright test` for E2E tests
6. Manual verification: open Live Preview, click elements, verify bidirectional communication still works

## Decisions

- **Vue private API (`__vueParentComponent`)**: Accepted risk. Statamic pins Vue versions; we'll adapt if it breaks. Document the risk in a code comment.
- **Dead code**: Remove both `StatamicVisualEditor.php` and `StatamicVisualEditor.vue`.
- **Shared constants module**: Not worth introducing a shared module between bridge.js and cp.js just for a few constants. Name them clearly in each file instead.
- **DOM parsing vs string replacement for `</body>`**: Keep string replacement but use last-occurrence replacement. Full DOM parsing is overkill for injecting a single script tag.

## Further Considerations

1. **Message versioning** — Consider adding `version: 1` to the postMessage schema so future bridge/CP version mismatches can be detected gracefully. Low effort, high future value. Recommendation: add it.
2. **Shared traversal helper** — The duplicated grouped/flat set iteration in `InjectVisualIdIntoBlueprint` and `StampVisualIds` could use a shared trait. However, the two listeners operate on different data shapes (blueprint contents vs entry data), so the trait would need to be generic. Recommendation: extract at minimum a `detectSetFormat()` static helper, but don't force an awkward abstraction if the callback signatures diverge too much.
3. **`InjectVisualIdIntoBlueprint` recursion depth** — No circular reference guard exists. If a fieldset imports itself transitively, this infinite-loops. Recommendation: add a `$depth` parameter with a max limit (e.g., 10), or track visited fieldset handles in a set.
