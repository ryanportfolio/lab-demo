// Drill-down and reversible interaction state. The path under test: pin a
// selection on the age curve (EXP-07's age_curve chart), promote it to a
// portfolio slice, drill further inside the slice's own territory chart,
// bottom out in policy records, then walk the whole thing back — chip
// removal, undo, clear, and Ctrl+Z. The slice state must ride the URL.

import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({
    timeout: 20_000,
  });
}

test('a pinned selection promotes to a slice; chips, undo, and clear walk it back', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  // no slice yet: the panel earns its place only when a constraint exists
  await expect(page.locator('.focus-panel')).toHaveCount(0);

  // pin the age curve's weakest slice, then promote it with the labeled
  // button — clicking alone must never filter
  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  await chart.locator('.pin-weakest').click();
  await expect(page.locator('.focus-panel')).toHaveCount(0);
  const promote = chart.locator('.act-focus');
  await expect(promote).toContainText('Slice portfolio · driver age');
  await promote.click();

  // the slice panel appears with the chip, the honesty banner, and totals
  const panel = page.locator('.focus-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.focus-chip')).toHaveCount(1);
  await expect(panel.locator('.focus-chip')).toContainText('driver age');
  await expect(panel.locator('.focus-banner')).toContainText('fitted on the full portfolio');
  await expect(panel.locator('.facts')).toContainText('policies');
  await expect(page).toHaveURL(/focus=driver_age/);

  // observed one-way charts recompute inside the slice, each with the shared
  // chart contract chrome (question line) and no SE toggle (observed only)
  for (const kind of ['slice_age', 'slice_accidents', 'slice_territory', 'slice_region']) {
    const sliceChart = panel.locator(`.chart-workspace[data-kind="${kind}"]`);
    await expect(sliceChart).toBeVisible();
    await expect(sliceChart.locator('.chart-question')).not.toBeEmpty();
  }

  // drill deeper from inside the slice: the territory chart's weakest zone
  const territory = panel.locator('.chart-workspace[data-kind="slice_territory"]');
  await territory.locator('.pin-weakest').click();
  await territory.locator('.act-focus').click();
  await expect(panel.locator('.focus-chip')).toHaveCount(2);
  await expect(page).toHaveURL(/focus=.*territory/);

  // the drill bottoms out in policy records, paginated
  await panel.locator('.focus-records-toggle').click();
  await expect(panel.locator('.focus-records-table tbody tr').first()).toBeVisible();
  await expect(panel.locator('.focus-records-pager')).toContainText('of');

  // removing a chip narrows the state by exactly that constraint
  await panel.locator('.focus-chip').last().click();
  await expect(panel.locator('.focus-chip')).toHaveCount(1);

  // undo restores it — the removal was one honest stack entry
  await panel.locator('.focus-undo').click();
  await expect(panel.locator('.focus-chip')).toHaveCount(2);

  // clear drops the whole slice and the panel with it; the URL follows
  await panel.locator('.focus-clear').click();
  await expect(page.locator('.focus-panel')).toHaveCount(0);
  await expect(page).not.toHaveURL(/focus=/);

  // Ctrl+Z is the keyboard path to the same undo stack
  await page.keyboard.press('Control+z');
  await expect(page.locator('.focus-panel .focus-chip')).toHaveCount(2);
});

test('a shared slice URL reopens the same slice', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1&focus=driver_age:18-24');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  const panel = page.locator('.focus-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.focus-chip')).toContainText('driver age 18–24');
  await expect(panel.locator('.facts')).toContainText('policies');
});
