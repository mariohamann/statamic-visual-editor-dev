import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for manual field targeting via the `field=` parameter.
 *
 * The `_meta.antlers.html` layout renders a "Page Info" panel in live preview
 * with [data-sid-field] elements for top-level fields (title, slug,
 * seo_title, seo_description) and a nested group field (page_info.author,
 * page_info.notes). These are all visible in the live preview iframe.
 *
 * The home entry (blueprint: page) is used as the test subject since it belongs
 * to the `pages` collection which uses the page blueprint with both the sidebar
 * (slug, page_info group) and SEO tab fields.
 */

const ENTRY_URL = '/cp/collections/pages/entries/home';

async function openLivePreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Live Preview' }).click();
  await page.locator('#live-preview-iframe').waitFor();

  // Wait for the bridge styles to confirm initBridge() has completed.
  await page
    .frameLocator('#live-preview-iframe')
    .locator('#__sve-bridge-styles')
    .waitFor({ state: 'attached' });

  // Wait for at least one [data-sid-field] element to be rendered.
  await page
    .frameLocator('#live-preview-iframe')
    .locator('[data-sid-field]')
    .first()
    .waitFor({ state: 'attached' });
}

test.describe('Manual field targeting via field= param', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENTRY_URL);
    await openLivePreview(page);
  });

  // ---------------------------------------------------------------------------
  // Preview → CP: click events jump to correct CP field
  // ---------------------------------------------------------------------------

  test('clicking data-sid-field="title" in iframe focuses the title field in CP', async ({
    page,
  }) => {
    // Wait for the field wrapper to be in the CP DOM.
    await page.locator('#field_title').waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="title"]')
      .click();

    await expect(page.locator('#field_title')).toHaveAttribute('data-sve-active', '');
  });

  test('clicking data-sid-field="slug" in iframe focuses the slug field in CP (sidebar tab)', async ({
    page,
  }) => {
    // The slug field lives in the sidebar tab — switchToContainingTab() must handle this.
    await page.locator('#field_slug').waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="slug"]')
      .click();

    await expect(page.locator('#field_slug')).toHaveAttribute('data-sve-active', '');
  });

  test('clicking data-sid-field="seo_title" in iframe focuses seo_title field in CP (SEO tab)', async ({
    page,
  }) => {
    await page.locator('#field_seo_title').waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="seo_title"]')
      .click();

    await expect(page.locator('#field_seo_title')).toHaveAttribute('data-sve-active', '');
  });

  test('clicking nested field data-sid-field="page_info.author" focuses the correct CP field', async ({
    page,
  }) => {
    // Nested group field: page_info.author → id="field_page_info_author"
    await page.locator('#field_page_info_author').waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="page_info.author"]')
      .click();

    await expect(page.locator('#field_page_info_author')).toHaveAttribute('data-sve-active', '');
  });

  test('clicking nested field data-sid-field="page_info.notes" focuses the notes field in CP', async ({
    page,
  }) => {
    await page.locator('#field_page_info_notes').waitFor({ state: 'attached' });

    const el = page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="page_info.notes"]');

    // Scroll into view in case it's below the fold in the preview iframe.
    await el.scrollIntoViewIfNeeded();
    await el.dispatchEvent('click');

    await expect(page.locator('#field_page_info_notes')).toHaveAttribute('data-sve-active', '');
  });

  test('clicking a second field clears active state from the first', async ({ page }) => {
    await page.locator('#field_title').waitFor({ state: 'attached' });
    await page.locator('#field_slug').waitFor({ state: 'attached' });

    const iframe = page.frameLocator('#live-preview-iframe');

    // Click title first.
    await iframe.locator('[data-sid-field="title"]').click();
    await expect(page.locator('#field_title')).toHaveAttribute('data-sve-active', '');

    // Click slug — title should lose active state.
    await iframe.locator('[data-sid-field="slug"]').click();
    await expect(page.locator('#field_title')).not.toHaveAttribute('data-sve-active');
    await expect(page.locator('#field_slug')).toHaveAttribute('data-sve-active', '');
  });

  // ---------------------------------------------------------------------------
  // Preview → CP: hover events
  // ---------------------------------------------------------------------------

  test('hovering data-sid-field="title" in iframe shows hover state on CP field', async ({
    page,
  }) => {
    await page.locator('#field_title').waitFor({ state: 'attached' });

    const iframe = page.frameLocator('#live-preview-iframe');

    await iframe.locator('[data-sid-field="title"]').hover();

    await expect(page.locator('#field_title')).toHaveAttribute('data-sve-hover', '');
  });

  test('moving off a data-sid-field element clears the hover state in CP', async ({ page }) => {
    await page.locator('#field_title').waitFor({ state: 'attached' });

    const iframe = page.frameLocator('#live-preview-iframe');

    // Hover over title to set hover state.
    await iframe.locator('[data-sid-field="title"]').hover();
    await expect(page.locator('#field_title')).toHaveAttribute('data-sve-hover', '');

    // Move to a non-annotated element (the body itself).
    await iframe.locator('body').hover({ position: { x: 5, y: 5 } });

    // Bridge sends hover with uid: null when leaving annotated elements.
    await expect(page.locator('#field_title')).not.toHaveAttribute('data-sve-hover');
  });

  // ---------------------------------------------------------------------------
  // Preview side: [data-sid-field] elements have correct attributes
  // ---------------------------------------------------------------------------

  test('[data-sid-field] elements auto-resolve their label from the blueprint in the preview', async ({ page }) => {
    const el = page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="title"]');

    await expect(el).toHaveAttribute('data-sid-label', 'Title');
  });

  test('[data-sid-field="page_info.author"] has correct dot-notation path', async ({ page }) => {
    const el = page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="page_info.author"]');

    await expect(el).toHaveAttribute('data-sid-field', 'page_info.author');
    await expect(el).toHaveAttribute('data-sid-label', 'Author');
  });

  // ---------------------------------------------------------------------------
  // inside="true" param: data-sid-inside attribute and inset outline-offset
  // ---------------------------------------------------------------------------

  test('meta panel elements have data-sid-inside attribute when outline-inside="true" is set', async ({
    page,
  }) => {
    const iframe = page.frameLocator('#live-preview-iframe');

    // All meta panel elements should carry data-sid-inside.
    for (const field of ['title', 'slug', 'seo_title', 'seo_description', 'page_info.author', 'page_info.notes']) {
      await expect(iframe.locator(`[data-sid-field="${field}"]`)).toHaveAttribute('data-sid-inside', '');
    }
  });

  test('data-sid-inside elements have inset outline-offset (-2px) applied', async ({ page }) => {
    const el = page
      .frameLocator('#live-preview-iframe')
      .locator('[data-sid-field="title"][data-sid-inside]');

    await expect(el).toBeVisible();

    const outlineOffset = await el.evaluate((node) =>
      getComputedStyle(node).outlineOffset
    );

    expect(outlineOffset).toBe('-2px');
  });
});
