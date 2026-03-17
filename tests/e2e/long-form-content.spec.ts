import { test, expect, Page } from '@playwright/test';

const ENTRY_URL = '/cp/collections/pages/entries/20f6a148-63b8-47a8-9b0e-d57095d78c21';

// Visual IDs from content snapshot (commit 87c6bfe)
const ARTICLE_UID = '4daf1d6b-11fb-4528-917f-6ce7a8022f0c'; // article Replicator set
const PULL_QUOTE_UID = 'cefeaf47-380f-4ec7-b8e6-2dfab00e8053'; // pull_quote Bard set inside article
const IMAGE_UID = '6bc1ebb5-e392-45ec-a8dd-e4dcf761e338'; // image Bard set inside article
const TABLE_UID = '7d3caaa8-6c1f-4c46-97e4-917718cae2fe'; // table Bard set inside article
const VIDEO_UID = '52e46cbc-cc5d-4453-8e04-b0a129dcc0d8'; // video Bard set inside article
const BUTTONS_UID = '2ea52104-031d-4b6d-ac9b-e833ed339744'; // buttons Bard set inside article
const FORM_UID = '878e266e-309e-4aef-88a3-c7aa2fd3fd32'; // form Replicator set

async function openLivePreview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Live Preview' }).click();
  await page.locator('#live-preview-iframe').waitFor();

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

// Nested Bard sets (node-view-wrappers) are only rendered by TipTap once the
// parent Replicator is expanded. Expand the article set first so all Bard node
// views mount, then wait for the specific node to become visible.
async function expandArticleAndWaitForBardSet(page: Page, uid: string): Promise<void> {
  // The article Replicator set is uniquely identified by its own data-visual-id
  // input. Use :scope > header so the toggle click targets only the article
  // set's own header, ignoring identical buttons inside nested Bard sets.
  const articleLocator = page.locator(
    `[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`
  );

  const collapsed = await articleLocator.getAttribute('data-collapsed');

  if (collapsed === 'true') {
    await articleLocator.locator(':scope > header > button[type="button"]').click();
    await page
      .locator(`[data-replicator-set][data-collapsed="false"]:has([data-visual-id="${ARTICLE_UID}"])`)
      .waitFor();
  }

  await page.locator(`[data-node-view-wrapper]:has([data-visual-id="${uid}"])`).waitFor();
}

test.describe('Long form content entry – Live Preview bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ENTRY_URL);
    await openLivePreview(page);
  });

  // -------------------------------------------------------------------------
  // iframe → CP: top-level Replicator sets
  // -------------------------------------------------------------------------

  test('clicking article section in iframe activates article set in CP', async ({ page }) => {
    // Target a leaf [data-sid] inside the article — a plain text wrapper
    // (<div class="span-md">) that has no nested [data-sid] children.
    // event.target.closest('[data-sid]') will return this element with the
    // article UID, so the bridge correctly identifies the article set.
    // Wait for the CP's AutoUuid input to be ready inside the article set.
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_UID}"]:not(:has([data-sid]))`)
      .first()
      .click();

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking form section in iframe activates form set in CP', async ({ page }) => {
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${FORM_UID}"]`)
      .first()
      .click();

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${FORM_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  // -------------------------------------------------------------------------
  // iframe → CP: nested Bard sets inside the article
  // -------------------------------------------------------------------------

  test('clicking pull_quote in iframe activates pull_quote Bard set and article stays expanded', async ({
    page,
  }) => {
    await expandArticleAndWaitForBardSet(page, PULL_QUOTE_UID);

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${PULL_QUOTE_UID}"]`)
      .first()
      .click();

    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${PULL_QUOTE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    // Article was already expanded by the helper; verify it stays expanded
    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
    ).not.toHaveAttribute('data-collapsed', 'true');
  });

  test('clicking image Bard set in iframe activates image set in CP', async ({ page }) => {
    await expandArticleAndWaitForBardSet(page, IMAGE_UID);

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${IMAGE_UID}"]`)
      .first()
      .click();

    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${IMAGE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking table Bard set in iframe activates table set in CP', async ({ page }) => {
    await expandArticleAndWaitForBardSet(page, TABLE_UID);

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${TABLE_UID}"]`)
      .first()
      .click();

    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${TABLE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking video Bard set in iframe activates video set in CP', async ({ page }) => {
    await expandArticleAndWaitForBardSet(page, VIDEO_UID);

    // The video element wraps a YouTube <iframe> (or a consent overlay <a>)
    // that absorbs a normal Playwright .click(). dispatchEvent dispatches a
    // synthetic MouseEvent directly on the consent_gate wrapper, triggering
    // the bridge's capture-phase listener without hitting any nested frame.
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${VIDEO_UID}"]`)
      .first()
      .dispatchEvent('click');

    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${VIDEO_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  test('clicking buttons Bard set in iframe activates buttons set in CP', async ({ page }) => {
    // The buttons <div> contains <a> elements that each have their own data-sid
    // (button items have _visual_id). dispatchEvent targets the outer buttons
    // container so the bridge sends the correct buttons-set UID.
    await expandArticleAndWaitForBardSet(page, BUTTONS_UID);

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${BUTTONS_UID}"]`)
      .first()
      .dispatchEvent('click');

    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${BUTTONS_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  // -------------------------------------------------------------------------
  // iframe → CP: Bard text nodes (data-sid-type="text")
  // -------------------------------------------------------------------------

  test('clicking first text node (before any Bard set) activates article set in CP', async ({
    page,
  }) => {
    // The first text group in the Bard article has no preceding set node, so
    // the bridge sends afterSetUid=null. The article Replicator set in CP
    // should become active and the clicked text element should be marked active
    // in the iframe.
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
      .waitFor({ state: 'attached' });
    const iframe = page.frameLocator('#live-preview-iframe');
    const firstTextNode = iframe.locator('[data-sid-type="text"]').first();

    await firstTextNode.click();

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    await expect(firstTextNode).toHaveAttribute('data-sid-active', '');
  });

  test('clicking text node after pull_quote Bard set activates article set with correct afterSetUid', async ({
    page,
  }) => {
    // The text group immediately following the pull_quote set should cause the
    // bridge to send afterSetUid=PULL_QUOTE_UID. The article set becomes active
    // in CP and the text element is marked active in the iframe.
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
      .waitFor({ state: 'attached' });

    const iframe = page.frameLocator('#live-preview-iframe');

    // Locate the [data-sid-type="text"] element that shares a parent with the
    // pull_quote element and comes after it.
    const textAfterPullQuote = iframe
      .locator(`[data-sid="${PULL_QUOTE_UID}"] ~ [data-sid-type="text"]`)
      .first();

    await textAfterPullQuote.click();

    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    await expect(textAfterPullQuote).toHaveAttribute('data-sid-active', '');
  });

  // -------------------------------------------------------------------------
  // State management
  // -------------------------------------------------------------------------

  test('clicking a nested Bard set then a Replicator set clears Bard active state', async ({
    page,
  }) => {
    await expandArticleAndWaitForBardSet(page, PULL_QUOTE_UID);
    const iframe = page.frameLocator('#live-preview-iframe');

    await iframe.locator(`[data-sid="${PULL_QUOTE_UID}"]`).first().click();
    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${PULL_QUOTE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    await iframe.locator(`[data-sid="${FORM_UID}"]`).first().click();

    await expect(
      page.locator(`[data-node-view-wrapper]:has([data-visual-id="${PULL_QUOTE_UID}"])`)
    ).not.toHaveAttribute('data-sve-active');
    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${FORM_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });

  // -------------------------------------------------------------------------
  // CP → iframe: hover events
  // -------------------------------------------------------------------------

  test('hovering a CP Replicator set highlights the matching element in the iframe', async ({
    page,
  }) => {
    // Ensure the form set is NOT the currently active set; if it were, cp.js
    // skips the hover message for already-active elements. Click the article
    // section first to make it the active set, then hover the form.
    await page
      .locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
      .waitFor({ state: 'attached' });

    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${ARTICLE_UID}"]:not(:has([data-sid]))`)
      .first()
      .click();
    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${ARTICLE_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');

    // Use the form set: it contains only a simple form-selector field with no
    // nested Replicator/Bard sets, so hovering its centre fires mouseover on
    // the form set itself — not on a child set.
    const cpFormSet = page.locator(
      `[data-replicator-set]:has([data-visual-id="${FORM_UID}"])`
    );
    await cpFormSet.hover();

    await expect(
      page.frameLocator('#live-preview-iframe').locator(`[data-sid="${FORM_UID}"]`).first()
    ).toHaveAttribute('data-sid-hover', '');
  });

  // -------------------------------------------------------------------------
  // Tab switching: iframe click on inactive tab's content switches CP tab
  // -------------------------------------------------------------------------

  test('clicking element in iframe while on SEO tab switches CP to main tab and activates set', async ({
    page,
  }) => {
    // Navigate to the SEO tab in the CP.
    await page.getByRole('tab', { name: 'SEO' }).click();
    await expect(page.getByRole('tab', { name: 'SEO' })).toHaveAttribute('data-state', 'active');

    // Click the form set element in the iframe (simpler than article — no nested Bard).
    await page
      .frameLocator('#live-preview-iframe')
      .locator(`[data-sid="${FORM_UID}"]`)
      .first()
      .click();

    // The Main tab should now be active.
    await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('data-state', 'active');

    // The form set in the CP should be highlighted as active.
    await expect(
      page.locator(`[data-replicator-set]:has([data-visual-id="${FORM_UID}"])`)
    ).toHaveAttribute('data-sve-active', '');
  });
});
