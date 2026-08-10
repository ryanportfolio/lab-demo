// Chart companions: ±2 SE bands, the exact-value side pane, and the
// provenance strip. House style: geometry and DOM assertions against the
// backend's completed run; screenshots are artifacts, not assertions.

import { test, expect } from '@playwright/test';

const AGE = '/?theme=light&noanim=1&exp=EXP-07&chart=age_curve';

test('the age curve carries a ±2 SE band that the toggle removes', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

  // band on by default, drawn behind the evidence marks
  await expect(card.locator('.chart-layer-uncertainty .se-band').first()).toBeVisible();
  const toggle = card.locator('.se-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await toggle.click();
  await expect(card.locator('.chart-layer-uncertainty .se-band')).toHaveCount(0);
  await toggle.click();
  await expect(card.locator('.chart-layer-uncertainty .se-band').first()).toBeVisible();
});

test('the reference age is exact and the thin tail is not', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

  // the value table is the precise surface: age 45 (the reference) shows no
  // interval, a thin-tail age shows its asymmetric range
  await card.locator('.exact-values summary').click();
  const ref = card.locator('.exact-values tr[data-x="45"]');
  const tail = card.locator('.exact-values tr[data-x="85"]');
  await expect(ref).toBeVisible();
  await expect(ref.locator('td small')).toHaveCount(0);
  await expect(tail.locator('td small').first()).toContainText(' to ');
});

test('a table row pins the chart selection and the URL follows', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

  await card.locator('.exact-values summary').click();
  await card.locator('.exact-values tr[data-x="70"] th button').click();
  await expect(card.locator('.selection-band')).toBeVisible();
  await expect(card.locator('.exact-values tr[data-x="70"]')).toHaveAttribute('aria-selected', 'true');
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
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

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
  await page.goto('/?theme=light&noanim=1&exp=EXP-03&chart=territory');
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.locator('.legend')).toContainText('Share of exposure');
});

test('a pinned banded point reads out its interval', async ({ page }) => {
  await page.goto(`${AGE}&sel=80:80`);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.locator('.selection-values')).toContainText(' to ');
});
