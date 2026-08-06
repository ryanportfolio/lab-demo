// The goal is the thing a reader keeps checking results against, so it stays
// on screen while the board scrolls under it.

import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = '../.tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

test('the goal stays pinned under the top bar while the board scrolls', async ({
  page,
}) => {
  await page.goto('/?theme=light');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());

  // the collapsed board fits the tall test viewport, so open the winner's
  // evidence to give the page something to scroll
  await page.locator('.exp.win .open-ev').click();
  await expect(page.locator('.exp.win .chart svg').first()).toBeVisible({
    timeout: 20_000,
  });
  await page.evaluate(() => window.scrollTo(0, 0));

  const goal = page.locator('.goal');
  const topbar = page.locator('.topbar');
  const before = await goal.boundingBox();
  expect(before).not.toBeNull();

  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const after = await goal.boundingBox();
  const bar = await topbar.boundingBox();
  expect(after).not.toBeNull();
  // it moved up with the scroll, then stopped at the bar rather than leaving
  expect(after!.y).toBeLessThan(before!.y);
  expect(after!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 2);
  expect(after!.y).toBeLessThan(bar!.y + bar!.height + 8);

  await page.screenshot({ path: `${OUT}/sticky-goal-light.png` });
});
