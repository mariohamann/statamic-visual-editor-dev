import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for stale-focus clearance.
 *
 * Before the fix, `data-sve-active` (CP outline) and `data-sid-active` (iframe
 * active highlight) were only cleared when a *new* focus fired — not when the
 * user clicked somewhere unrelated. Three gaps were closed:
 *
 *   Gap 1 (cp.js – set branch):  Clicking a CP set now immediately clears the
 *     old `data-sve-active` and places it on the newly clicked set, without
 *     waiting for a message round-trip from the preview.
 *
 *   Gap 2 (cp.js – fallthrough): Clicking a generic CP area (not a set, not a
 *     field wrapper) now removes any stale `data-sve-active`.
 *
 *   Gap 3 (bridge.js – !target): Clicking an unannotated element inside the
 *     preview iframe now clears `data-sid-active` from the previously active
 *     element.
 */

const ENTRY_URL = '/cp/collections/pages/entries/home';

// Visual IDs from the content snapshot used by the test suite.
const ARTICLE_1_UID = 'c637b0b2-8208-460c-9a3a-cffdf8376c8c';
const ARTICLE_2_UID = '941e2737-6b15-46f2-b3f6-f179a6294211';

async function openLivePreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Live Preview' }).click();
  await page.locator('#live-preview-iframe').waitFor();

  await page
    .frameLocator('#live-preview-iframe')
    .locator('[data-sid]')
    .first()
    .waitFor({ state: 'attached' });

  await page
    .frameLocator('#live-preview-iframe')
    .locator('#__sve-bridge-styles')
    .waitFor({ state: 'attached' });

  await page.locator('[data-replicator-set]').first().waitFor({ state: 'attached' });
}

test.describe('Stale focus clearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENTRY_URL);
    await openLivePreview(page);
  });

  // ---------------------------------------------------------------------------
  // Gap 2 — clicking a generic CP area clears data-sve-active
  // ---------------------------------------------------------------------------

  test('clicking a generic CP area dismisses the active outline on the previously focused set', async ({
    page,
  }) => {
    const article1Set = page.locator(
      `[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`,
    );
    await article1Set.waitFor({ state: 'attached' });

    // Focus article 1 via an iframe click.
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]`)
      .first()
      .click();

    await expect(article1Set).toHaveAttribute('data-sve-active', '');

    // Click on a generic CP area — the document body, which is guaranteed not
    // to be inside any [data-replicator-set] or field_* wrapper. The click
    // bubbles up to the document-level handleClick listener.
    await page.evaluate(() => {
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await expect(article1Set).not.toHaveAttribute('data-sve-active');
  });

  // ---------------------------------------------------------------------------
  // Gap 1 — clicking a CP set clears the stale data-sve-active immediately
  // ---------------------------------------------------------------------------

  test('clicking a different CP set after an iframe click removes the old active outline', async ({
    page,
  }) => {
    const article1Set = page.locator(
      `[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`,
    );
    const article2Set = page.locator(
      `[data-replicator-set]:has([data-visual-id="${ARTICLE_2_UID}"])`,
    );

    await article1Set.waitFor({ state: 'attached' });
    await article2Set.waitFor({ state: 'attached' });

    // Focus article 1 via an iframe click.
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]`)
      .first()
      .click();

    await expect(article1Set).toHaveAttribute('data-sve-active', '');

    // Simulate the user clicking article 2's set header in the CP. dispatchEvent
    // targets the set element directly — event.target.closest(anySet) resolves
    // to the set itself, which is what a real header click would produce.
    await article2Set.dispatchEvent('click');

    // Article 1's outline must be gone; article 2 must now be active.
    await expect(article1Set).not.toHaveAttribute('data-sve-active');
    await expect(article2Set).toHaveAttribute('data-sve-active', '');
  });

  // ---------------------------------------------------------------------------
  // Gap 3 — clicking a non-annotated area in the iframe clears data-sid-active
  // ---------------------------------------------------------------------------

  test('clicking a non-annotated area in the preview iframe clears the active iframe highlight', async ({
    page,
  }) => {
    const iframe = page.frameLocator('#live-preview-iframe');

    await iframe
      .locator(`[data-sid="${ARTICLE_1_UID}"]`)
      .first()
      .waitFor({ state: 'attached' });

    // Use dispatchEvent so event.target is exactly the [data-sid] element, not a
    // nested child — that guarantees data-sid-active is set on this exact element.
    await iframe.locator(`[data-sid="${ARTICLE_1_UID}"]`).first().dispatchEvent('click');

    await expect(iframe.locator(`[data-sid="${ARTICLE_1_UID}"]`).first()).toHaveAttribute(
      'data-sid-active',
      '',
    );

    // Click the iframe body at an area without any [data-sid] / [data-sid-field]
    // annotation. The bridge click handler's !target guard now clears active state.
    await iframe.locator('body').dispatchEvent('click');

    await expect(iframe.locator(`[data-sid="${ARTICLE_1_UID}"]`).first()).not.toHaveAttribute(
      'data-sid-active',
    );
  });
});
