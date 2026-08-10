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

test('the full view carries the comparison switch and lands a new turn at the top', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  const full = page.locator('.chart-full-split');
  const rail = page.locator('.chart-studio-rail');
  await expect(rail).toBeVisible();

  // Level and Change are read where the chart is read largest
  await expect(full).toHaveAttribute('data-mode', 'level');
  await full.locator('.chart-mode button', { hasText: 'Change' }).click();
  await expect(full).toHaveAttribute('data-mode', 'change');
  await expect(page).toHaveURL(/mode=change/);

  // a question sent from the composer puts its own turn at the top of the
  // transcript, even when the answer is too short to fill the panel
  await rail.locator('.ask-sugg button').first().click();
  await expect(rail.locator('.ask-row.ai').first()).toBeVisible({ timeout: 15_000 });
  await rail.locator('textarea').fill('What is the weather in Chicago tomorrow?');
  await rail.locator('textarea').press('Enter');
  await expect(rail.locator('.ask-turn')).toHaveCount(2, { timeout: 30_000 });
  const offset = await rail.locator('.ask-turn').nth(1).evaluate((el) => {
    const body = el.closest('.ask-body') as HTMLElement;
    return el.getBoundingClientRect().top - body.getBoundingClientRect().top;
  });
  expect(offset).toBeLessThan(24);
});

test('a new question lands at the top from any scroll position, and stays stuck there', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);
  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  const rail = page.locator('.chart-studio-rail');
  await expect(rail).toBeVisible();
  const bodyEl = rail.locator('.ask-body');

  const turnOffset = (index: number) =>
    rail.locator('.ask-turn').nth(index).evaluate((el) => {
      const body = el.closest('.ask-body') as HTMLElement;
      return el.getBoundingClientRect().top - body.getBoundingClientRect().top;
    });

  // seed a first turn with a chart in it, so later layout lands late
  await rail.locator('.ask-sugg button').first().click();
  await expect(rail.locator('.ask-row.ai').first()).toBeVisible({ timeout: 20_000 });

  // ask from the top, the middle, and the bottom of the transcript: every
  // question anchors its own turn to the top of the panel
  const places = [
    () => bodyEl.evaluate((el) => el.scrollTo({ top: 0 })),
    () => bodyEl.evaluate((el) => el.scrollTo({ top: el.scrollHeight / 2 })),
    () => bodyEl.evaluate((el) => el.scrollTo({ top: el.scrollHeight })),
  ];
  // alternate a suggested question, whose answer draws charts and so settles
  // over several frames, with a typed one whose answer is a short miss
  const asks = [
    () => rail.locator('.ask-followups .ask-sugg button').first().click(),
    async () => {
      await rail.locator('textarea').fill('What is the weather in Chicago tomorrow?');
      await rail.locator('textarea').press('Enter');
    },
    () => rail.locator('.ask-followups .ask-sugg button').first().click(),
  ];
  for (const [i, place] of places.entries()) {
    await place();
    await page.waitForTimeout(120);
    await asks[i]();
    await expect(rail.locator('.ask-turn')).toHaveCount(i + 2, { timeout: 30_000 });
    await expect.poll(() => turnOffset(i + 1), { timeout: 10_000 }).toBeLessThan(24);
    // and it holds after the answer's own layout has landed
    await page.waitForTimeout(900);
    expect(await turnOffset(i + 1)).toBeLessThan(24);
  }

  // content above the newest turn can settle late (a webfont landing, a chart
  // sizing itself). The pin has to survive that, not fire once and hope.
  await rail.locator('textarea').fill('One more question about this run?');
  await rail.locator('textarea').press('Enter');
  const latest = places.length + 1;
  await expect(rail.locator('.ask-turn')).toHaveCount(latest + 1, { timeout: 30_000 });
  await expect.poll(() => turnOffset(latest), { timeout: 10_000 }).toBeLessThan(24);
  await rail.locator('.ask-turn').first().evaluate((el) => {
    const grow = document.createElement('div');
    grow.style.height = '260px';
    el.appendChild(grow);
  });
  await expect.poll(() => turnOffset(latest), { timeout: 5_000 }).toBeLessThan(24);

  // reading down through an answer keeps its question on the top edge
  const first = rail.locator('.ask-turn').first();
  const firstTop = await turnOffset(0);
  await bodyEl.evaluate((el, delta) => el.scrollTo({ top: el.scrollTop + delta + 320 }), firstTop);
  await page.waitForTimeout(200);
  const stuckOffset = await first.locator('.ask-row.you').evaluate((el) => {
    const body = el.closest('.ask-body') as HTMLElement;
    return el.getBoundingClientRect().top - body.getBoundingClientRect().top;
  });
  expect(stuckOffset).toBeGreaterThanOrEqual(-2);
  expect(stuckOffset).toBeLessThan(16);
  await expect(first.locator('.ask-row.you .bubble')).toBeVisible();
  // a held question says so, so the handoff can be drawn rather than guessed
  await expect(first.locator('.ask-row.you')).toHaveAttribute('data-held', 'true');

  // and it fades out as the next question comes up to take the edge
  const second = rail.locator('.ask-turn').nth(1);
  const secondTop = await turnOffset(1);
  await bodyEl.evaluate((el, d) => el.scrollBy({ top: d - 26 }), secondTop);
  await page.waitForTimeout(200);
  const fade = await first.locator('.ask-row.you').evaluate((el) => ({
    handoff: Number(getComputedStyle(el).getPropertyValue('--handoff')),
    opacity: Number(getComputedStyle(el).opacity),
  }));
  expect(fade.handoff).toBeGreaterThan(0);
  expect(fade.opacity).toBeLessThan(0.95);
  // once it has gone, the next question holds the edge instead
  await bodyEl.evaluate((el) => el.scrollBy({ top: 60 }));
  await page.waitForTimeout(200);
  await expect(second.locator('.ask-row.you')).toHaveAttribute('data-held', 'true');
  await expect(first.locator('.ask-row.you')).not.toHaveAttribute('data-held', 'true');

  // and the next question takes the top edge from it
  await bodyEl.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await page.waitForTimeout(200);
  const firstNowAbove = await first.locator('.ask-row.you').evaluate((el) => {
    const body = el.closest('.ask-body') as HTMLElement;
    return el.getBoundingClientRect().bottom <= body.getBoundingClientRect().top + 1;
  });
  expect(firstNowAbove).toBe(true);
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

  // and it opens again on demand, scrolling itself into view rather than
  // unfolding below the fold
  await rail.locator('.ask-followups summary').click();
  const last = rail.locator('.ask-followups .ask-sugg button').last();
  await expect(last).toBeVisible();
  const inView = await last.evaluate((el) => {
    const body = el.closest('.ask-body') as HTMLElement;
    return el.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1;
  });
  expect(inView).toBe(true);
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
