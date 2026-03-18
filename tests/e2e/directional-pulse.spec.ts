import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for directional pulse animations.
 *
 * Pulses are cross-boundary signals: they fire to give feedback across the
 * CP↔preview boundary, but never locally within the same context.
 *
 *   Preview click → CP pulses       (sve-field-highlight-pulse / sve-highlight-pulse)
 *   CP click      → preview pulses  (sve-cp-pulse)
 *   CP click      → CP does NOT pulse
 *   Preview click → preview does NOT pulse
 */

const ENTRY_URL = '/cp/collections/pages/entries/home';

// Replicator set with plain text only — no nested [data-sid] children, so a
// direct click on its preview element reliably sends ARTICLE_1_UID to the CP.
const ARTICLE_1_UID = 'c637b0b2-8208-460c-9a3a-cffdf8376c8c';

async function openLivePreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Live Preview' }).click();
  await page.locator('#live-preview-iframe').waitFor();

  const iframe = page.frameLocator('#live-preview-iframe');

  // Wait for bridge.js to confirm initBridge() has completed.
  await iframe.locator('#__sve-bridge-styles').waitFor({ state: 'attached' });
  await iframe.locator('[data-sid]').first().waitFor({ state: 'attached' });
  await iframe.locator('[data-sid-field]').first().waitFor({ state: 'attached' });

  // Wait for CP Replicator sets to be mounted by Vue.
  await page.locator('[data-replicator-set]').first().waitFor({ state: 'attached' });
}

/**
 * Registers an `animationstart` listener on the CP main document BEFORE an
 * action is taken. Returns a function that waits 600 ms (long enough for any
 * postMessage round-trip + animation start) and then reports whether the named
 * animation ever fired.
 */
async function watchCpAnimation(page: Page, animationName: string): Promise<() => Promise<boolean>> {
  await page.evaluate((name: string) => {
    (window as any).__sveCpAnimSeen = false;
    document.addEventListener('animationstart', (e: Event) => {
      if ((e as AnimationEvent).animationName === name) {
        (window as any).__sveCpAnimSeen = true;
      }
    }, true);
  }, animationName);

  return async () => {
    await page.waitForTimeout(600);
    return page.evaluate(() => Boolean((window as any).__sveCpAnimSeen));
  };
}

/**
 * Registers an `animationstart` listener inside the live-preview iframe BEFORE
 * an action is taken. Returns a function that waits 600 ms and reports whether
 * the named animation ever fired in the iframe.
 */
async function watchPreviewAnimation(page: Page, animationName: string): Promise<() => Promise<boolean>> {
  await page.evaluate((name: string) => {
    const iframe = document.getElementById('live-preview-iframe') as HTMLIFrameElement;
    (window as any).__svePrevAnimSeen = false;
    iframe?.contentDocument?.addEventListener('animationstart', (e: Event) => {
      if ((e as AnimationEvent).animationName === name) {
        (window as any).__svePrevAnimSeen = true;
      }
    }, true);
  }, animationName);

  return async () => {
    await page.waitForTimeout(600);
    return page.evaluate(() => Boolean((window as any).__svePrevAnimSeen));
  };
}

test.describe('Directional pulse animations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENTRY_URL);
    await openLivePreview(page);
  });

  // -------------------------------------------------------------------------
  // Field animations
  // -------------------------------------------------------------------------

  test('clicking a field in the preview pulses the CP field (preview→CP)', async ({ page }) => {
    await page.locator('#field_title').waitFor({ state: 'attached' });
    const check = await watchCpAnimation(page, 'sve-field-highlight-pulse');

    await page.frameLocator('#live-preview-iframe').locator('[data-sid-field="title"]').click();

    expect(await check()).toBe(true);
  });

  test('clicking a field directly in the CP does NOT pulse the CP field', async ({ page }) => {
    await page.locator('#field_title').waitFor({ state: 'attached' });
    const check = await watchCpAnimation(page, 'sve-field-highlight-pulse');

    await page.locator('#field_title').click();

    expect(await check()).toBe(false);
  });

  test('clicking a field in the CP pulses the matching preview element (CP→preview)', async ({ page }) => {
    await page.locator('#field_title').waitFor({ state: 'attached' });
    const check = await watchPreviewAnimation(page, 'sve-cp-pulse');

    await page.locator('#field_title').click();

    expect(await check()).toBe(true);
  });

  test('clicking a field in the preview does NOT pulse the preview element', async ({ page }) => {
    const check = await watchPreviewAnimation(page, 'sve-cp-pulse');

    await page.frameLocator('#live-preview-iframe').locator('[data-sid-field="title"]').click();

    expect(await check()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Set animations
  // -------------------------------------------------------------------------

  test('clicking a set in the preview pulses the CP set (preview→CP)', async ({ page }) => {
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
      .waitFor({ state: 'attached' });
    const check = await watchCpAnimation(page, 'sve-highlight-pulse');

    // Target the leaf [data-sid] node (no nested data-sid children) so the
    // click reliably sends ARTICLE_1_UID rather than a child set UID.
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]:not(:has([data-sid]))`)
      .first()
      .click();

    expect(await check()).toBe(true);
  });

  test('clicking a set directly in the CP does NOT pulse the CP set', async ({ page }) => {
    const cpSet = page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`);
    await cpSet.waitFor({ state: 'attached' });
    const check = await watchCpAnimation(page, 'sve-highlight-pulse');

    // dispatchEvent targets the set element itself so closest(anySet) resolves
    // to it immediately — mirrors the pattern used in home.spec.ts.
    await cpSet.dispatchEvent('click');

    expect(await check()).toBe(false);
  });

  test('clicking a set in the CP pulses the matching preview element (CP→preview)', async ({ page }) => {
    const cpSet = page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`);
    await cpSet.waitFor({ state: 'attached' });
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]`)
      .first()
      .waitFor({ state: 'attached' });
    const check = await watchPreviewAnimation(page, 'sve-cp-pulse');

    await cpSet.dispatchEvent('click');

    expect(await check()).toBe(true);
  });

  test('clicking a set in the preview does NOT pulse the preview element', async ({ page }) => {
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
      .waitFor({ state: 'attached' });
    const check = await watchPreviewAnimation(page, 'sve-cp-pulse');

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]:not(:has([data-sid]))`)
      .first()
      .click();

    expect(await check()).toBe(false);
  });
});
