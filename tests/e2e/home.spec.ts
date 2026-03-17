import { test, expect, Page } from '@playwright/test';

const ENTRY_URL = '/cp/collections/pages/entries/home';

// Visual IDs from content snapshot (commit 87c6bfe)
const ARTICLE_1_UID = 'c637b0b2-8208-460c-9a3a-cffdf8376c8c'; // first article Replicator set (plain text only — no nested data-sid children)
const CARD_1_UID = 'c8b48fcb-69e8-4365-8c28-377a849f422f';   // first card item inside the cards page-builder set
const ARTICLE_2_UID = '941e2737-6b15-46f2-b3f6-f179a6294211'; // second article Replicator set
const PULL_QUOTE_UID = '7ecc7f15-7f3a-49f5-83c2-880cda2e2ceb'; // pull_quote Bard set inside article 2
const CARD_1_BUTTON_UID = 'a1b2c3d4-0001-4000-8000-000000000001'; // button item inside card 1 (cards block → card → button replicator → button set)

async function openLivePreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Live Preview' }).click();
  await page.locator('#live-preview-iframe').waitFor();

  // Wait until the preview iframe has rendered at least one annotated element
  await page
    .frameLocator('#live-preview-iframe')
    .locator('[data-sid]')
    .first()
    .waitFor({ state: 'attached' });

  // bridge.js is a type="module" script — it runs after HTML parsing. Wait for
  // the style element it injects, which confirms initBridge() has run and all
  // click/hover/message listeners are registered before any test interaction.
  await page
    .frameLocator('#live-preview-iframe')
    .locator('#__sve-bridge-styles')
    .waitFor({ state: 'attached' });

  // Wait for the CP's Replicator sets to be rendered (Vue hydration may lag
  // behind the iframe content being ready).
  await page.locator('[data-replicator-set]').first().waitFor({ state: 'attached' });
}

test.describe('Home entry – Live Preview bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENTRY_URL);
    await openLivePreview(page);
  });

  // -------------------------------------------------------------------------
  // iframe → CP: click events
  // -------------------------------------------------------------------------

  test('clicking article section in iframe activates article set in CP', async ({ page }) => {
    // Article 1 contains only plain text (headings/paragraphs rendered by
    // _text.antlers.html). Each text wrapper is a leaf [data-sid] with the
    // same UID as the outer section. Clicking it reliably sends the article UID.
    // Wait for the CP's AutoUuid input to be mounted inside the article set so
    // findSetByUid can resolve the UID before the click fires.
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]:not(:has([data-sid]))`)
      .first()
      .click();

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking a card item in iframe activates that card item set in CP', async ({ page }) => {
    // Clicking the cards *block* section at its center always lands on individual
    // card items, which have their own data-sid. This tests the real user flow:
    // clicking a card item should activate that item's set in the CP.
    // Card items are nested inside the collapsed cards Replicator, so they exist
    // in the DOM but are not visible until expanded. Use 'attached' state.
    await page
      .locator(`[data-replicator-set][data-type="card"]:has([data-visual-id="${CARD_1_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${CARD_1_UID}"]`)
      .first()
      .click();

    await expect(
      page.locator(`[data-replicator-set][data-type="card"]:has([data-visual-id="${CARD_1_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking nested pull_quote in iframe activates Bard set and article stays expanded', async ({
    page,
  }) => {
    // Wait for the Bard editor inside article 2 to mount its node-view-wrappers
    // before clicking — handleFocus needs the element in the CP DOM to succeed.
    // The node-view-wrapper exists inside a collapsed set, so use 'attached'.
    await page
      .locator(`[data-node-view-wrapper]:has([data-visual-id="${PULL_QUOTE_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${PULL_QUOTE_UID}"]`)
      .first()
      .click();

    // The pull_quote Bard set should be active in the CP
    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${PULL_QUOTE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    // Its parent article Replicator set should not be collapsed
    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_2_UID}"])`)
    ).not.toHaveAttribute('data-collapsed', 'true');
  });

  test('clicking a second element clears active state from the first', async ({ page }) => {
    // Wait for the article 1 CP input before clicking to avoid findSetByUid race.
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
      .waitFor({ state: 'attached' });

    const iframe = page.frameLocator('#live-preview-iframe');

    // Click article 1 (plain text — no nested data-sid children, center click works)
    await iframe.locator(`[data-sid="${ARTICLE_1_UID}"]`).first().click();
    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    // Article 2 contains a pull_quote with its own data-sid, so clicking the
    // center would send the pull_quote uid instead. Use dispatchEvent to target
    // the section element directly.
    await iframe.locator(`[data-sid="${ARTICLE_2_UID}"]`).first().dispatchEvent('click');

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
    ).not.toHaveAttribute('data-sve-active');
    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_2_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  // -------------------------------------------------------------------------
  // iframe → CP: hover events
  // -------------------------------------------------------------------------

  test('hovering an element in iframe shows hover state on matching CP set', async ({ page }) => {
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]`)
      .first()
      .hover();

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
    ).toHaveAttribute('data-sve-hover', '');
  });

  test('CP hover dashes clear when mouse exits the preview iframe', async ({ page }) => {
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
      .waitFor({ state: 'attached' });

    // Hover a preview element so CP dashes appear.
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_1_UID}"]`)
      .first()
      .hover();

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
    ).toHaveAttribute('data-sve-hover', '');

    // Simulate the mouse leaving the iframe (same-origin: we can reach its document
    // directly). This is equivalent to physically moving the mouse out of the iframe
    // into the surrounding CP chrome — which is what the mouseleave fix handles.
    await page.evaluate(() => {
      const iframe = document.getElementById('live-preview-iframe') as HTMLIFrameElement;
      iframe?.contentDocument?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, cancelable: false }));
    });

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`)
    ).not.toHaveAttribute('data-sve-hover');
  });

  // -------------------------------------------------------------------------
  // CP → iframe: hover events
  // -------------------------------------------------------------------------

  test('hovering a CP set highlights the matching element in the iframe', async ({ page }) => {
    // Use article 1: its CP Replicator set contains only Bard text (headings +
    // paragraphs), no nested Replicator/Bard sets. Hovering its center fires
    // mouseover on article 1 itself, not on a child set.
    const cpArticle1Set = page.locator(
      `[data-replicator-set]:has([data-visual-id="${ARTICLE_1_UID}"])`
    );
    await cpArticle1Set.waitFor({ state: 'attached' });
    await cpArticle1Set.hover();

    await expect(
      page.frameLocator('#live-preview-iframe').locator(`[data-sid="${ARTICLE_1_UID}"]`).first()
    ).toHaveAttribute('data-sid-hover', '');
  });

  // -------------------------------------------------------------------------
  // Deep nesting: string field references (field: 'fieldset.handle')
  // -------------------------------------------------------------------------

  test('clicking button inside card activates button set and all ancestor sets expand', async ({
    page,
  }) => {
    // The button is nested 4 levels deep:
    //   page_builder (replicator) → cards set → card item → button (replicator) → button item
    // The button field is defined as `field: buttons.buttons` (string reference)
    // and only receives _visual_id after the string-reference fix in InjectVisualIdIntoBlueprint.
    await page
      .locator(`[data-replicator-set][data-type="button"]:has([data-visual-id="${CARD_1_BUTTON_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${CARD_1_BUTTON_UID}"]`)
      .first()
      .click();

    // The button set must be active in the CP
    await expect(
      page.locator(`[data-replicator-set][data-type="button"]:has([data-visual-id="${CARD_1_BUTTON_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    // The parent card item must not be collapsed
    await expect(
      page.locator(`[data-replicator-set][data-type="card"]:has([data-visual-id="${CARD_1_UID}"])`)
    ).not.toHaveAttribute('data-collapsed', 'true');
  });
});
