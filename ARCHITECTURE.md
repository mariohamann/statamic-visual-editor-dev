# Statamic Visual Editor: Bidirectional Communication Architecture

## Overview
The addon enables Storyblok-like click-to-edit by implementing bidirectional `postMessage` communication between the Live Preview iframe and the Control Panel (CP). Clicking an element in the preview auto-focuses the corresponding CP field.

## Key Components

### 1. Backend (PHP)
- **ServiceProvider**: Registers middleware, tags, listeners, and Vite config
- **InjectBridgeScript middleware**: Injects bridge.js into Live Preview iframe's `</body>` tag
- **VisualEdit tag**: Outputs data-sid/data-sid-field attributes (no-op in production)
- **StampVisualIds listener**: Auto-assigns UUIDs to Replicator/Bard/Grid sets
- **InjectVisualIdIntoBlueprint listener**: Injects visual-id fields into blueprints

### 2. Frontend (JavaScript)

#### bridge.js (iframe-side)
- Initializes only when `window.self !== window.top` (inside iframe)
- **Listeners**:
  - `mousemove`: Shows dashed outlines on hovered [data-sid] elements
  - `click` (capture phase): Sends postMessage to CP when element clicked
  - `mouseover` (capture phase): Sends hover messages to CP
  - `mouseleave`: Clears CP hover state
  - `message`: Receives and applies focus/hover from CP

- **Key functions**:
  - `createClickHandler()`: Sends `{source, type: 'click', uid|field, afterSetUid?}` to CP
  - `createHoverHandler()`: Sends `{source, type: 'hover', uid|field, afterSetUid?}` to CP
  - `createMessageReceiver()`: Applies focus/hover from CP by setting `data-sid-active` or `data-sid-hover` attributes
  - `findTextAfterSetUid()`: Identifies text nodes in Bard by preceding set
  - `injectStyles()`: Adds dashed/solid outline styling
  - `injectCpVariables()`: Copies outline color tokens from CP to iframe

#### cp.js (Control Panel-side)
- Initializes after setup, creates message listener and event handlers
- **Listeners**:
  - `message`: Routes incoming preview messages to handlers
  - `mouseover`: Sends hover to preview when hovering CP sets/fields
  - `click`: Sends focus to preview when clicking CP sets

- **Key functions**:
  - `handleFocus(uid, doc, afterSetUid?)`: Expands nested sets, scrolls, highlights target
  - `handleHover(uid)`: Applies hover outline without activating
  - `handleFieldFocus(fieldPath)`: Focuses specific CP field by dot-notation path
  - `handleFieldHover(fieldPath)`: Applies hover outline to field wrapper
  - `findSetByUid()`: Locates set in CP by UUID
  - `switchToContainingTab()`: Switches to tab if set is in inactive panel
  - `sendToPreview()`: Posts message to iframe's contentWindow
  - `createMessageListener()`: Routes preview messages based on `data.type`

#### addon.js
- Registers Vue component and calls `initCp()`

#### StatamicVisualEditor.vue
- Simple UUID input fieldtype component

## Message Protocol

**Preview → CP (postMessage)**
```javascript
// Click on [data-sid] Replicator/Bard set
{ source: 'statamic-visual-editor', type: 'click', uid: '...uuid...', afterSetUid?: '...uuid...' }

// Click on [data-sid-field] field element
{ source: 'statamic-visual-editor', type: 'click', field: 'dot.separated.path', label?: 'Field Name' }

// Hover on element
{ source: 'statamic-visual-editor', type: 'hover', uid|field, label?, afterSetUid? }
```

**CP → Preview (postMessage)**
```javascript
// Focus after CP click or programmatic trigger
{ source: 'statamic-visual-editor', type: 'focus', uid|field, afterSetUid? }

// Hover when hovering CP sets/fields
{ source: 'statamic-visual-editor', type: 'hover', uid|field, afterSetUid? }
```

## Data Attributes

**Preview iframe annotations:**
- `data-sid="uuid"`: Marks Replicator/Bard/Grid set
- `data-sid-field="path"`: Marks specific field element
- `data-sid-type="..."`: "text", component type names
- `data-sid-label="..."`: Display name for label tooltip
- `data-sid-inside`: Outline should be inset
- `data-sid-active`: Currently focused element (solid outline)
- `data-sid-hover`: Currently hovered element (dashed outline)
- `data-sid-inner`: Innermost hovered element during mouse movement

**CP annotations:**
- `data-visual-id`: UUID stored in Replicator/Bard/Grid items
- `data-replicator-set`: Replicator container
- `data-node-view-wrapper`: Bard set wrapper
- `data-collapsed="true|false"`: Replicator collapse state
- `data-sve-active`: Currently focused set/field
- `data-sve-hover`: Currently hovered set/field
- `[role="tabpanel"]`: Tab panel containing field
- `field_{handle}`: Field wrapper ID (handle with dots→underscores)

## UUID Assignment Flow

1. **Entry/Globals saved**
2. `EntrySaving` / `GlobalVariablesSaving` event fires
3. `StampVisualIds` listener processes data:
   - Walks Replicator/Bard/Grid structure via blueprint
   - Assigns UUIDs to items without `_visual_id`
   - Recursively handles nested fields
4. Data persisted with UUIDs embedded in YAML/JSON

## Text Node Targeting (Bard-specific)

Bard allows plain text between node-view sets. Targeting text requires both:
- `uid`: The parent Replicator set's UUID
- `afterSetUid`: The preceding Bard set node's UUID (null for first text group)

This enables precise scroll-to-text and prevents the "double jump" effect.

## Tab Switching

When a focused set/field lives in an inactive tab panel:
1. Extract tab handle from panel ID pattern: `reka-tabs-v-N-content-{handle}`
2. Walk Vue component parent chain from trigger element
3. Find Statamic's `PublishTabs` component's `setActive(handle)` function
4. Call it to activate the tab
5. Defer scroll/highlight by 0ms to let Vue update DOM

## Click Prevention

When expanding a set programmatically:
- Use `dispatchEvent(new MouseEvent('click', { bubbles: false }))`
- Non-bubbling click triggers Vue handler but NOT document-level click listener
- Prevents feedback loop where expand sends focus message back to preview

## Styling

**Bridge styles** (in iframe):
- `[data-sid], [data-sid-field]`: Base cursor pointer + outline properties
- `[data-sid-active]`: Solid outline with focus color
- `[data-sid-hover]`: Dashed outline with hover color
- `.sve-mouse-active [data-sid]`: Show dashed outline during mouse movement
- `[data-sid-label]::after`: Tooltip label
- `[data-sid-inside]`: Inset outline-offset (-2px)

**CP styles** (in cp.js):
- `[data-sve-active]`: Solid blue outline
- `[data-sve-hover]`: Dashed blue outline
- `.sve-highlight`: Pulse animation on Replicator sets
- `.sve-field-highlight`: Pulse animation on specific fields
- `ProseMirror-selectednode`: Class added to Bard sets (pre-existing Statamic style)

## Test Coverage

E2E tests verify:
- Preview→CP: clicking sets, fields, text nodes, nested structures
- CP→Preview: hovering sets sends highlight message
- Tab switching and scroll positioning
- Bard toolbar offset calculations
- State cleanup (clearing previous active elements)
- Field label resolution from blueprint
- Collapsed state detection (Replicator vs Bard)
