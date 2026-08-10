// The drill-down and the context expert, driven against the real backend.
// Screenshots land in ../.tmp/shots for the orchestrator to read.

import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = '../.tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

async function ready(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
}

test('every ledger entry resolves to its retained evidence', async ({ page }) => {
  await page.goto('/?theme=light');
  await ready(page);

  const rows = page.locator('.ledger-row');
  const count = await rows.count();
  expect(count).toBe(7);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const code = (await row.locator('.ledger-code').innerText()).trim();
    await row.click();
    // every experiment owes the reader an artifact, fitted or refused
    await expect(page.locator('.selected-evidence .evidence-head')).toContainText(code, {
      timeout: 20_000,
    });
    await expect(page.locator('.selected-evidence .chart svg').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(row).toHaveAttribute('aria-pressed', 'true');
  }
});

test('winner evidence, light and dark', async ({ page }) => {
  await page.goto('/?theme=light&plain=1');
  await ready(page);
  const winner = page.locator('.ledger-row', { hasText: 'EXP-07' });
  await winner.click();
  const evidence = page.locator('.selected-evidence .evidence');
  await expect(evidence.locator('.chart svg').first()).toBeVisible({
    timeout: 20_000,
  });
  // one chart tells the story at a time; four linked artifacts remain available
  await expect(evidence.locator('.chart')).toHaveCount(1, { timeout: 20_000 });
  await expect(evidence.locator('.evidence-tabs button')).toHaveCount(4);
  await expect(evidence.locator('.facts')).toContainText('rows');
  await page.screenshot({ path: `${OUT}/evidence-winner-light.png`, fullPage: true });

  await page.goto('/?theme=dark');
  await ready(page);
  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await expect(page.locator('.selected-evidence .chart svg').first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${OUT}/evidence-winner-dark.png`, fullPage: true });
});

test('the context expert answers from artifacts and cites them', async ({
  page,
}) => {
  await page.goto('/?theme=light&plain=1');
  await ready(page);

  await page.locator('.askbtn').click();
  await expect(page.locator('.ask')).toBeVisible();
  await page.screenshot({ path: `${OUT}/ask-open-light.png`, fullPage: true });

  // the page underneath holds still while the palette is up
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(20, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  // the first suggested question is the one from their own deck
  await page.locator('.ask-sugg button').first().click();
  await expect(page.locator('.ask-row.ai .bubble')).toBeVisible({
    timeout: 30_000,
  });
  // the read trace is folded away until asked for
  await expect(page.locator('.step').first()).toBeHidden();
  await page.locator('.steps > summary').first().click();
  await expect(page.locator('.step').first()).toBeVisible();
  await expect(page.locator('.ask-row.ai .chart svg').first()).toBeVisible();
  const steps = await page.locator('.step code').allInnerTexts();
  expect(steps).toContain('readFitArtifact');
  const text = await page.locator('.ask').innerText();
  expect(text).not.toContain('—');
  await page.screenshot({ path: `${OUT}/ask-answer-light.png`, fullPage: true });

  // an answer is not a dead end, and asking again does not erase it: the
  // unasked questions wait under the transcript
  const followups = page.locator('.ask-followups .ask-sugg button');
  await expect(followups.first()).toBeVisible();
  await followups.first().click();
  await expect(page.locator('.ask-turn')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.locator('.ask-row.ai .bubble').first()).toBeVisible();

  // a citation takes the reader to the card it was read from
  await page.locator('.cites button').first().click();
  await expect(page.locator('.ask')).toBeHidden();
  await expect(page.locator('.selected-evidence .evidence')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('.ledger-row[aria-pressed="true"]')).toBeVisible();
});

test('the context expert misses honestly', async ({ page }) => {
  await page.goto('/?theme=dark');
  await ready(page);
  await page.keyboard.press('Control+k');
  await expect(page.locator('.ask')).toBeVisible();
  await page.locator('.ask-compose textarea').fill('what is the weather in texas');
  await page.locator('.ask-send').click();
  await expect(page.locator('.ask-row.ai .bubble')).toContainText(
    'No artifact in this run matches that question',
    { timeout: 30_000 },
  );
  await expect(page.locator('.ask-row.ai .chart')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/ask-miss-dark.png`, fullPage: true });
});
