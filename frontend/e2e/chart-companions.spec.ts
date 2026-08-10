// Chart companions: ±2 SE bands, the exact-value side pane, and the
// provenance strip. House style: geometry and DOM assertions against the
// backend's completed run; screenshots are artifacts, not assertions.

import { test, expect, type Page } from '@playwright/test';

const AGE = '/?theme=light&noanim=1&exp=EXP-07&chart=age_curve';

/**
 * Open a chart and wait for the one that was actually asked for.
 *
 * Against a live backend the newest run can still be mid-flight, so a
 * requested experiment may not exist yet and the app falls back to another
 * one. Asserting the rendered kind turns that into an immediate, legible
 * failure instead of a two-minute timeout on a locator that was never going
 * to appear (see reference/pitfalls.md on shared live-run state).
 */
async function openChart(page: Page, url: string, kind: string) {
  await page.goto(url);
  const card = page.locator(`.selected-evidence .chart-workspace[data-kind="${kind}"]`);
  await expect(card).toBeVisible({ timeout: 90_000 });
  return card;
}

test('the age curve carries a ±2 SE band that the toggle removes', async ({ page }) => {
  const card = await openChart(page, AGE, 'age_curve');

  // band on by default, drawn behind the evidence marks
  await expect(card.locator('.chart-layer-uncertainty .se-band').first()).toBeVisible();
  const toggle = card.locator('.se-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await toggle.click();
  await expect(card.locator('.chart-layer-uncertainty .se-band')).toHaveCount(0);
  await toggle.click();
  await expect(card.locator('.chart-layer-uncertainty .se-band').first()).toBeVisible();
});

// The card's value table is a sibling of the chart figure, not a child of it
// (Chart renders the <figure class="chart-workspace">; EvidencePanel renders
// the table beside it), so these locators are page-scoped on purpose.
test('the reference age is exact and the thin tail is not', async ({ page }) => {
  await openChart(page, AGE, 'age_curve');

  // the value table is the precise surface: age 45 (the reference) shows no
  // interval, a thin-tail age shows its asymmetric range
  const table = page.locator('.selected-evidence .exact-values');
  await table.locator('summary').click();
  const ref = table.locator('tr[data-x="45"]');
  const tail = table.locator('tr[data-x="85"]');
  await expect(ref).toBeVisible();
  await expect(ref.locator('td small')).toHaveCount(0);
  await expect(tail.locator('td small').first()).toContainText(' to ');
});

test('a table row pins the chart selection and the URL follows', async ({ page }) => {
  const card = await openChart(page, AGE, 'age_curve');

  const table = page.locator('.selected-evidence .exact-values');
  await table.locator('summary').click();
  await table.locator('tr[data-x="70"] th button').click();
  await expect(card.locator('.selection-band')).toBeVisible();
  await expect(table.locator('tr[data-x="70"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/sel=70(%3A|:)70/);
});

test('the studio full view seats the value table beside the plot', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${AGE}&full=1`);
  const full = page.locator('.chart-full');
  await expect(full).toBeVisible({ timeout: 90_000 });

  const pane = full.locator('.chart-table-pane');
  await expect(pane).toBeVisible();
  // side by side: the pane starts right of the plot's end
  const plot = await full.locator('.chart-full-body > svg').boundingBox();
  const table = await pane.boundingBox();
  expect(table!.x).toBeGreaterThanOrEqual(plot!.x + plot!.width - 1);

  // the hide control folds the pane away and the preference persists
  await full.locator('.chart-table-toggle').click();
  await expect(pane).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.chart-full')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.chart-full .chart-table-pane')).toHaveCount(0);
  await page.locator('.chart-full .chart-table-toggle').click();
  await expect(page.locator('.chart-full .chart-table-pane')).toBeVisible();
});

test('every value column stays reachable in the studio pane', async ({ page }) => {
  // Regression: the pane shipped 320px wide with the card's 220px inner cap,
  // so "% vs v12" and "Earned exposure" were clipped with no way to scroll to
  // them and only 5 of 73 rows rendered. Geometry, because a DOM-presence
  // assertion passes happily on a clipped table.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${AGE}&full=1`);
  const pane = page.locator('.chart-full .chart-table-pane');
  await expect(pane).toBeVisible({ timeout: 90_000 });

  // headers render uppercase via text-transform, so compare case-insensitively
  const headers = (await pane.locator('thead th').allInnerTexts()).join(' ').toLowerCase();
  expect(headers).toContain('vs v12');
  expect(headers).toContain('earned exposure');

  const scroll = page.locator('.chart-full .chart-table-scroll');
  const box = await scroll.evaluate((el) => ({
    cw: el.clientWidth,
    sw: el.scrollWidth,
    ch: el.clientHeight,
    sh: el.scrollHeight,
  }));
  expect(box.sw, 'columns past the pane edge must be scrollable to').toBeGreaterThan(box.cw);
  expect(box.sh, 'all rows must be scrollable to').toBeGreaterThan(box.ch);
  expect(await pane.locator('tbody tr').count()).toBeGreaterThan(60);

  // the values toggle must not print over the column headers
  const btn = (await page.locator('.chart-table-toggle').boundingBox())!;
  const head = (await pane.locator('thead th').first().boundingBox())!;
  expect(btn.y + btn.height, 'toggle sits above the header row').toBeLessThanOrEqual(head.y + 1);
});

test('the full view survives a reload with the studio open', async ({ page }) => {
  // the StrictMode double-mount regression: a ?full=1 load must keep the
  // studio open instead of silently closing it after the second effect run
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${AGE}&full=1`);
  await expect(page.locator('.chart-full')).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(400);
  await expect(page.locator('.chart-full')).toBeVisible();
});

test('the companion strip names version, window, and the CI method while bands are up', async ({ page }) => {
  const card = await openChart(page, AGE, 'age_curve');

  const companion = card.locator('.chart-companion');
  await expect(companion).toContainText('v12');
  await expect(companion).toContainText('train');
  await expect(companion).toContainText('holdout');
  await expect(companion).toContainText('±2 SE');

  // the method line is owed exactly while the bands are on screen
  await card.locator('.se-toggle').click();
  await expect(companion).not.toContainText('±2 SE from the final fit weights');
});

test('territory carries its exposure series with the filed dots', async ({ page }) => {
  const card = await openChart(
    page,
    '/?theme=light&noanim=1&exp=EXP-03&chart=territory',
    'territory',
  );
  await expect(card.locator('.legend')).toContainText('Share of exposure');
});

test('a pinned banded point reads out its interval', async ({ page }) => {
  const card = await openChart(page, `${AGE}&sel=80:80`, 'age_curve');
  await expect(card.locator('.selection-values')).toContainText(' to ');
});
