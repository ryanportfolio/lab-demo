// Active model context is the thing a reviewer keeps checking evidence against,
// so it sits in an inspector rail beside the working paper and stays pinned
// under the breadcrumb bar while the paper scrolls.

import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = '../.tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

test('active model context stays pinned beside the working paper while it scrolls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/?theme=light');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());

  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await expect(page.locator('.selected-evidence .chart svg').first()).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('.exact-values summary').click();
  await page.evaluate(() => window.scrollTo(0, 0));

  const context = page.locator('.context-strip');
  const topbar = page.locator('.topbar');
  const before = await context.boundingBox();
  expect(before).not.toBeNull();

  // The rail is beside the working paper, not stacked above it
  const paper = await page.locator('.run-view').boundingBox();
  expect(before!.x).toBeGreaterThanOrEqual(paper!.x + paper!.width - 1);

  // Placed right, read first: the rail leads the shell in the DOM so keyboard
  // and screen-reader order reach the context before the evidence it frames.
  const railLeadsDom = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    return shell?.firstElementChild?.classList.contains('context-strip') ?? false;
  });
  expect(railLeadsDom).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 1_400));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const after = await context.boundingBox();
  const bar = await topbar.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.y).toBe(before!.y);
  expect(after!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 2);
  expect(after!.y).toBeLessThan(bar!.y + bar!.height + 8);

  await page.screenshot({ path: `${OUT}/sticky-goal-light.png` });
});
