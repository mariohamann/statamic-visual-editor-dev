import { test, expect, Page } from '@playwright/test';

const ENTRY_URL = '/cp/collections/pages/entries/home';

// Visual IDs from content snapshot — home.md links Grid rows
const LINK_1_UID = '11111111-1111-4111-8111-111111111111';
const LINK_2_UID = '22222222-2222-4222-8222-222222222222';

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

  // Wait for Grid rows to be stamped with [data-grid-row] by the MutationObserver.
  await page.locator('[data-grid-row]').first().waitFor({ state: 'attached' });
}

test.describe('Grid rows – Live Preview bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENTRY_URL);
    await openLivePreview(page);
  });

  // -------------------------------------------------------------------------
  // iframe → CP: clicking a Grid row element focuses the row in the CP
  // -------------------------------------------------------------------------

  test('clicking first grid row in iframe activates its CP row', async ({ page }) => {
    await page
      .locator(`[data-grid-row]:has([data-visual-id="${LINK_1_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${LINK_1_UID}"]`)
      .click();

    await expect(
      page.locator(`[data-grid-row]:has([data-visual-id="${LINK_1_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking second grid row in iframe activates its CP row', async ({ page }) => {
    await page
      .locator(`[data-grid-row]:has([data-visual-id="${LINK_2_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${LINK_2_UID}"]`)
      .click();

    await expect(
      page.locator(`[data-grid-row]:has([data-visual-id="${LINK_2_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking second row deactivates first row', async ({ page }) => {
    await page
      .locator(`[data-grid-row]:has([data-visual-id="${LINK_1_UID}"])`)
      .waitFor({ state: 'attached' });

    // Click first row
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${LINK_1_UID}"]`)
      .click();

    await expect(
      page.locator(`[data-grid-row]:has([data-visual-id="${LINK_1_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    // Click second row
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${LINK_2_UID}"]`)
      .click();

    await expect(
      page.locator(`[data-grid-row]:has([data-visual-id="${LINK_1_UID}"])`)
    ).not.toHaveAttribute('data-sve-active', '');

    await expect(
      page.locator(`[data-grid-row]:has([data-visual-id="${LINK_2_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  // -------------------------------------------------------------------------
  // CP → iframe: hovering a Grid row in the CP highlights the preview element
  // -------------------------------------------------------------------------

  test('hovering first grid row in CP highlights corresponding element in iframe', async ({
    page,
  }) => {
    const cpRow = page.locator(`[data-grid-row]:has([data-visual-id="${LINK_1_UID}"])`);
    await cpRow.waitFor({ state: 'attached' });

    await cpRow.hover();

    await expect(
      page.frameLocator('#live-preview-iframe').locator(`[data-sid="${LINK_1_UID}"]`)
    ).toHaveAttribute('data-sid-hover', '');
  });
});
