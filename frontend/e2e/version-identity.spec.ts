// FR-2/FR-5: version identity. An approved review whose version is replaced
// by a later replay says so and still renders the decision-time package that
// was frozen at sign-off.

import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = '../.tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

async function ready(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
}

async function runId(page: Page): Promise<string> {
  const crumb = await page.locator('nav[aria-label="Breadcrumb"]').innerText();
  const m = crumb.match(/Run (\d+)/);
  expect(m).not.toBeNull();
  return m![1];
}

async function approveOpenReview(page: Page) {
  await page.locator('.promote button').click();
  const gate = page.locator('.approval-actions');
  await expect(gate.or(page.locator('.stamp')).first()).toBeVisible({ timeout: 20_000 });
  // The review object refreshes asynchronously just after the view opens and
  // that refresh resets the acknowledgment checkbox; let it settle first
  await page.waitForTimeout(900);
  if (await gate.count()) {
    await gate.locator('input[type="checkbox"]').check();
    await expect(gate.locator('button')).toBeEnabled();
    await gate.locator('button').click();
    await expect(page.locator('.stamp')).toBeVisible({ timeout: 20_000 });
  }
  await page.locator('.review-head .back').click();
}

async function replay(page: Page) {
  // The previous run's promote banner stays visible until the new run lands;
  // wait for the run id to change before waiting for completion, or ready()
  // returns instantly against the old, already-complete run
  const before = await runId(page);
  await page.locator('.replay').click();
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).not.toContainText(
    `Run ${before}`,
    { timeout: 30_000 },
  );
  await ready(page);
}

test('a replaced approval keeps its frozen decision-time record', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto('/?theme=light');
  await ready(page);

  // A fresh run whose approval is recorded with a snapshot
  await replay(page);
  const firstRun = await runId(page);
  await approveOpenReview(page);

  // A later replay's approval replaces the version the first one created
  await replay(page);
  await approveOpenReview(page);

  // The first review announces its fate and renders what was signed
  await page.goto(`/?run=${firstRun}&view=review&theme=light`);
  await expect(page.locator('.review-version .status.superseded')).toContainText(
    /No longer in force/,
    { timeout: 30_000 },
  );
  await expect(page.locator('.as-approved-why')).toContainText('replaced by');
  const frozen = page.locator('.as-approved');
  await expect(frozen).toContainText('frozen at sign-off');
  await expect(frozen).toContainText('agent actions');
  await expect(page.locator('.review-metrics')).toContainText('Question → decision');

  // Desktop measure: the frozen record keeps a readable width
  const box = (await frozen.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(900);
  await page.screenshot({ path: `${OUT}/superseded-review.png`, fullPage: false });
});
