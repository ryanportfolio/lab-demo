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

test('evidence opens on every landed card', async ({ page }) => {
  await page.goto('/?theme=light');
  await ready(page);

  const cards = page.locator('.exp');
  const count = await cards.count();
  expect(count).toBe(7);

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const code = (await card.locator('.id').innerText()).trim();
    await card.locator('.open-ev').click();
    // every experiment owes the reader an artifact, fitted or refused
    await expect(card.locator('.evidence')).toBeVisible({ timeout: 20_000 });
    await expect(card.locator('.chart svg').first()).toBeVisible({
      timeout: 20_000,
    });
    const charts = await card.locator('.chart').count();
    expect(charts, `${code} should draw at least one chart`).toBeGreaterThan(0);
    if (i > 0) await card.locator('.open-ev').click();
  }
});

test('winner evidence, light and dark', async ({ page }) => {
  await page.goto('/?theme=light&plain=1');
  await ready(page);
  const winner = page.locator('.exp.win');
  await winner.locator('.open-ev').click();
  await expect(winner.locator('.chart svg').first()).toBeVisible({
    timeout: 20_000,
  });
  // the winner carries its archetype charts plus lift and folds
  await expect(winner.locator('.chart')).toHaveCount(4, { timeout: 20_000 });
  await expect(winner.locator('.facts')).toContainText('training rows');
  await page.screenshot({ path: `${OUT}/evidence-winner-light.png`, fullPage: true });

  await page.goto('/?theme=dark');
  await ready(page);
  const w2 = page.locator('.exp.win');
  await w2.locator('.open-ev').click();
  await expect(w2.locator('.chart svg').first()).toBeVisible({ timeout: 20_000 });
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
  await expect(page.locator('.step').first()).toBeVisible();
  await expect(page.locator('.ask-row.ai .chart svg').first()).toBeVisible();
  const steps = await page.locator('.step code').allInnerTexts();
  expect(steps).toContain('readFitArtifact');
  const text = await page.locator('.ask').innerText();
  expect(text).not.toContain('—');
  await page.screenshot({ path: `${OUT}/ask-answer-light.png`, fullPage: true });

  // an answer is not a dead end: the question list is one click back
  await page.locator('.ask-back').click();
  await expect(page.locator('.ask-sugg button').first()).toBeVisible();
  await page.locator('.ask-sugg button').first().click();
  await expect(page.locator('.ask-row.ai .bubble')).toBeVisible({
    timeout: 30_000,
  });

  // a citation takes the reader to the card it was read from
  await page.locator('.cites button').first().click();
  await expect(page.locator('.ask')).toBeHidden();
  await expect(page.locator('.exp.open .evidence')).toBeVisible({
    timeout: 20_000,
  });
});

test('the context expert misses honestly', async ({ page }) => {
  await page.goto('/?theme=dark');
  await ready(page);
  await page.keyboard.press('Control+k');
  await expect(page.locator('.ask')).toBeVisible();
  await page.locator('.ask-bar input').fill('what is the weather in texas');
  await page.keyboard.press('Enter');
  await expect(page.locator('.ask-row.ai .bubble')).toContainText(
    'No artifact in this run matches that question',
    { timeout: 30_000 },
  );
  await expect(page.locator('.ask-row.ai .chart')).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/ask-miss-dark.png`, fullPage: true });
});
