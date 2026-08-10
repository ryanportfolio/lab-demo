import { expect, test, type Page } from '@playwright/test';

// The chart studio: full view is an edge-to-edge split with the chart on the
// left and a docked Ask rail on the right, persisted as sessions per run.

async function ready(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({
    timeout: 20_000,
  });
}

test('the full view opens as a full-screen split with a docked ask rail', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  const rail = page.locator('.chart-studio-rail');
  await expect(rail).toBeVisible();

  // edge to edge: the studio spans the whole viewport, dialog chrome gone
  const scrim = page.locator('.chart-scrim.studio');
  await expect(scrim).toBeVisible();
  const scrimBox = await scrim.boundingBox();
  expect(scrimBox!.width).toBeGreaterThan(1270);

  // a suggested question answers from artifacts, beside the chart
  await rail.locator('.ask-sugg button').first().click();
  await expect(rail.locator('.ask-row.ai').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.chart-full')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(rail).toBeHidden();
});

test('ask about selection opens the studio seeded with the pinned context', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  await chart.locator('.pin-weakest').click();
  await expect(chart.locator('.chart-selection')).toBeVisible();
  await chart.locator('.chart-actions button', { hasText: 'Ask about selection' }).click();

  const rail = page.locator('.chart-studio-rail');
  await expect(rail).toBeVisible();
  await expect(page).toHaveURL(/full=1/);
  // the composed question and its context chip both carry the selection
  await expect(rail.locator('textarea')).toHaveValue(/Explain/);
  await expect(rail.locator('.ask-chip')).toContainText('EXP-07');

  await rail.locator('.ask-send').click();
  await expect(rail.locator('.ask-row.ai').first()).toBeVisible({ timeout: 15_000 });
  await expect(rail.locator('.ask-row.you .ask-chip-echo')).toContainText('EXP-07');

  // citations travel out of the studio to the cited experiment's evidence
  const cite = rail.locator('.cites button').first();
  await expect(cite).toBeVisible();
  const cited = (await cite.innerText()).split('·')[0].trim();
  await cite.click();
  await expect(rail).toBeHidden();
  await expect(page.locator('.selected-evidence .evidence-head')).toContainText(cited);
});

test('sessions persist on this browser and restore with the link', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  const rail = page.locator('.chart-studio-rail');
  await rail.locator('.ask-sugg button').first().click();
  await expect(rail.locator('.ask-row.ai').first()).toBeVisible({ timeout: 15_000 });
  const askedText = await rail.locator('.ask-row.you .bubble').first().innerText();

  // the URL carries full=1; reopening it restores the studio and the thread
  // (no ledger click here: a shared link lands on the auto-selected winner)
  await expect(page).toHaveURL(/full=1/);
  await page.goto(page.url());
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await expect(rail).toBeVisible({ timeout: 20_000 });
  await expect(rail.locator('.ask-row.you .bubble').first()).toContainText(
    askedText.split('\n')[0].slice(0, 40),
  );

  // a new session starts clean; the sessions list switches back
  await rail.locator('.ask-sess-new').click();
  await expect(rail.locator('.ask-intro')).toBeVisible();
  await rail.locator('.ask-sess-toggle').click();
  await rail.locator('.ask-sess-open').first().click();
  await expect(rail.locator('.ask-row.you').first()).toBeVisible();
});

test('right-click on a selected slice is the ask shortcut, on the big chart and on answer charts', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  const rail = page.locator('.chart-studio-rail');
  await expect(rail).toBeVisible();

  // the studio's big chart: pin the weakest slice, right-click, and the
  // composer is seeded with the question and its context chip
  await page.locator('.chart-full-diagnostics .pin-weakest').click();
  await page.locator('.chart-full > svg').click({ button: 'right' });
  await expect(rail.locator('textarea')).toHaveValue(/Explain/);
  await expect(rail.locator('.ask-chip')).toContainText('EXP-07');

  // an answer's mini chart can do the same without a workspace context
  await rail.locator('.ask-chip button').click();
  await rail.locator('.ask-sugg button').first().click();
  const answerChart = rail.locator('.ask-row.ai .chart').first();
  await expect(answerChart).toBeVisible({ timeout: 15_000 });
  await answerChart.locator('.pin-weakest').click();
  await expect(answerChart.locator('.chart-actions button', { hasText: 'Ask about selection' })).toBeVisible();
  await answerChart.locator('svg').first().click({ button: 'right' });
  await expect(rail.locator('.ask-foot .ask-chip')).toBeVisible();
  await expect(rail.locator('textarea')).toHaveValue(/Explain/);
});

test('keep going opens by default and stays folded once the reader folds it', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  const rail = page.locator('.chart-studio-rail');
  await rail.locator('.ask-sugg button').first().click();
  const followups = rail.locator('.ask-followups');
  await expect(followups).toBeVisible({ timeout: 15_000 });
  await expect(followups).toHaveAttribute('open', '');
  await expect(followups.locator('.ask-sugg button').first()).toBeVisible();

  // folded by the reader, and it stays folded across a reload
  await followups.locator('summary').click();
  await expect(followups.locator('.ask-sugg button').first()).toBeHidden();
  await page.goto(page.url());
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await expect(rail).toBeVisible({ timeout: 20_000 });
  await expect(rail.locator('.ask-followups')).not.toHaveAttribute('open', '');

  // and it opens again on demand
  await rail.locator('.ask-followups summary').click();
  await expect(rail.locator('.ask-followups .ask-sugg button').first()).toBeVisible();
});

test('the seam between chart and rail drags, persists, and resets on double-click', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  const rail = page.locator('.chart-studio-rail');
  await expect(rail).toBeVisible();
  const before = (await rail.boundingBox())!.width;

  const seam = (await page.locator('.studio-resize').boundingBox())!;
  const y = seam.y + seam.height / 2;
  await page.mouse.move(seam.x + seam.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(seam.x + seam.width / 2 - 120, y, { steps: 6 });
  await page.mouse.up();
  const dragged = (await rail.boundingBox())!.width;
  expect(dragged).toBeGreaterThan(before + 100);

  // the width is a preference: it survives reopening the studio by link
  await page.goto(page.url());
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await expect(rail).toBeVisible({ timeout: 20_000 });
  expect((await rail.boundingBox())!.width).toBeGreaterThan(before + 100);

  await page.locator('.studio-resize').dblclick();
  expect((await rail.boundingBox())!.width).toBeLessThan(before + 10);
});

test('narrow viewports keep the centered dialog and the palette fallback', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 1200 });
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  await chart.locator('.expand').click();
  await expect(page.locator('.chart-full')).toBeVisible();
  await expect(page.locator('.chart-studio-rail')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // asks fall back to the ⌘K palette below the rail breakpoint
  await chart.locator('.pin-weakest').click();
  await chart.locator('.chart-actions button', { hasText: 'Ask about selection' }).click();
  await expect(page.locator('.ask')).toBeVisible();
  await expect(page.locator('.ask textarea')).toHaveValue(/Explain/);
});
