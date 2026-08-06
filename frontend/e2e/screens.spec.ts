// Headless verification: drive a real run against the real backend and
// capture both views in both themes. Screenshots land in ../.tmp/shots.

import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = '../.tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

async function freeze(page: Page) {
  await page.evaluate(() => (window as any).__capture.freeze());
}

async function waitForComplete(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
}

test('console mid-run and final, light', async ({ page }) => {
  await page.goto('/?theme=light');
  // fresh run so the mid-run state is real
  const replay = page.locator('.replay');
  await replay.waitFor();
  if (await replay.isEnabled()) {
    await replay.click();
    // the previous run's promote bar stays until the new run takes over
    await expect(page.locator('.promote')).toBeHidden({ timeout: 15_000 });
  }
  await expect(page.locator('.exp').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/console-midrun-light.png`, fullPage: true });
  await waitForComplete(page);
  await freeze(page);
  await page.screenshot({ path: `${OUT}/console-final-light.png`, fullPage: true });

  // expert layer sanity: chips carry real numbers, verdicts are written
  await expect(page.locator('.exp .verdict')).toHaveCount(7, {
    timeout: 30_000,
  });
  const text = await page.locator('.main').innerText();
  expect(text).toContain('ΔGini');
  expect(text).not.toContain('—'); // no em dashes anywhere
});

test('console final, dark, plain terms on', async ({ page }) => {
  await page.goto('/?theme=dark&plain=1');
  await waitForComplete(page);
  await freeze(page);
  await expect(page.locator('.gloss.block')).toBeVisible();
  await page.screenshot({ path: `${OUT}/console-final-dark-plain.png`, fullPage: true });
});

test('review open and approve, light', async ({ page }) => {
  await page.goto('/?theme=light#review');
  await expect(page.locator('.rv-head')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.led-row')).toHaveCount(7);
  await freeze(page);
  await page.screenshot({ path: `${OUT}/review-open-light.png`, fullPage: true });

  const approve = page.locator('.rv-approve button');
  if (await approve.isVisible()) {
    await approve.click();
    await expect(page.locator('.rv-approve .stamp')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.status.approved')).toBeVisible();
  }
  await page.screenshot({ path: `${OUT}/review-approved-light.png`, fullPage: true });
});

test('review, dark', async ({ page }) => {
  await page.goto('/?theme=dark#review');
  await expect(page.locator('.rv-head')).toBeVisible({ timeout: 90_000 });
  await freeze(page);
  await page.screenshot({ path: `${OUT}/review-dark.png`, fullPage: true });
});
