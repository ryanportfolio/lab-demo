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
  await expect(page.locator('.ledger-row').first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/console-midrun-light.png`, fullPage: true });
  await waitForComplete(page);
  await freeze(page);
  await page.screenshot({ path: `${OUT}/console-final-light.png`, fullPage: true });

  // expert layer sanity: chips carry real numbers, verdicts are written
  await expect(page.locator('.ledger-row')).toHaveCount(7, {
    timeout: 30_000,
  });
  const text = await page.locator('.run-view').innerText();
  expect(text).toContain('Experiment frontier');
  expect(text).not.toContain('—'); // no em dashes anywhere
});

test('console final, dark, one active evidence chart', async ({ page }) => {
  await page.goto('/?theme=dark&plain=1');
  await waitForComplete(page);
  await freeze(page);
  await expect(page.locator('.selected-evidence .chart')).toHaveCount(1);
  await expect(page.locator('.selected-evidence .evidence-tabs button')).toHaveCount(4);
  await page.screenshot({ path: `${OUT}/console-final-dark-plain.png`, fullPage: true });
});

test('review open and approve, light', async ({ page }) => {
  await page.goto('/?theme=light#review');
  await expect(page.locator('.review-head')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.led-row')).toHaveCount(7);
  await freeze(page);
  await page.screenshot({ path: `${OUT}/review-open-light.png`, fullPage: true });

  const approve = page.locator('.approval-gate button');
  if (await approve.isVisible()) {
    await page.locator('.approval-actions input').check();
    await approve.click();
    await expect(page.locator('.approval-gate .stamp')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.status.approved')).toBeVisible();
  }
  await page.screenshot({ path: `${OUT}/review-approved-light.png`, fullPage: true });
});

test('review, dark', async ({ page }) => {
  await page.goto('/?theme=dark#review');
  await expect(page.locator('.review-head')).toBeVisible({ timeout: 90_000 });
  await freeze(page);
  await page.screenshot({ path: `${OUT}/review-dark.png`, fullPage: true });
});

test('layered entrance frames and static motion preferences', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?theme=light');
  await waitForComplete(page);
  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await expect(page.locator('.selected-evidence .chart-layer-evidence')).toBeAttached();

  const setEntranceTime = async (time: number) => {
    await page.evaluate((currentTime) => {
      for (const animation of document.getAnimations()) {
        if ((animation as CSSAnimation).animationName !== 'entrance-resolve') continue;
        animation.pause();
        animation.currentTime = currentTime;
      }
    }, time);
  };

  await setEntranceTime(0);
  await page.screenshot({ path: `${OUT}/motion-initial-1920.png` });
  await setEntranceTime(350);
  await page.screenshot({ path: `${OUT}/motion-mid-1920.png` });
  await setEntranceTime(1000);
  await page.screenshot({ path: `${OUT}/motion-settled-1920.png` });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?theme=light');
  await waitForComplete(page);
  await expect(page.locator('.selected-evidence .chart-layer-evidence')).toBeAttached();
  await page.screenshot({ path: `${OUT}/motion-reduced-1920.png` });

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?theme=light&noanim=1');
  await waitForComplete(page);
  await expect(page.locator('.selected-evidence .chart-layer-evidence')).toBeAttached();
  await page.screenshot({ path: `${OUT}/motion-noanim-1920.png` });
  await page.screenshot({ path: `${OUT}/evidence-studio-desktop-1920.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?theme=light&noanim=1&exp=EXP-07&chart=age_curve');
  await waitForComplete(page);
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible();
  await page.screenshot({ path: `${OUT}/evidence-studio-mobile-390.png`, fullPage: true });

  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto('/?theme=light&noanim=1&exp=EXP-07&chart=age_curve');
  await waitForComplete(page);
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible();
  await page.screenshot({ path: `${OUT}/evidence-studio-ultrawide-2560.png`, fullPage: true });
});
