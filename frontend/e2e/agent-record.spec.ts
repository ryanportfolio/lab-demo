// FR-1: the action-level agent record. A run leaves an attributable,
// previewable trail with visible refusals and reverts; the record survives
// into the review package; approval appends the run's one human,
// irreversible action.

import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = '../.tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

async function ready(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
}

test('a run leaves an agent record that survives into review and approval', async ({ page }) => {
  await page.goto('/?theme=light');
  await ready(page);

  const record = page.locator('.agent-record');
  await expect(record).toBeVisible();

  // The collapsed record announces itself as expandable
  const toggle = record.locator('.record-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  // Runs from before action capture show an honest empty state; replay to
  // record a fresh run rather than fabricating history for old ones. The
  // panel stays open across the replay (component state, not DOM toggling).
  await expect(record.locator('.agent-record-empty, .act-row').first()).toBeVisible();
  if ((await record.locator('.agent-record-empty').count()) > 0) {
    await page.locator('.replay').click();
    await ready(page);
  }

  // The trail is action-level, not a one-line summary
  const rows = record.locator('.act-row');
  expect(await rows.count()).toBeGreaterThanOrEqual(10);

  // Refusals stay visible, with the reason, not silently dropped
  await expect(record.locator('.act-refuse .act-refusal').first()).toBeVisible();
  // A scrapped change is explicitly reverted, demonstrating reversibility
  await expect(record.locator('.act-revert').first()).toBeVisible();
  // Change actions carry a before/after preview
  await expect(record.locator('.act-change .act-diff').first()).toBeVisible();
  // The handoff states the boundary: the agent cannot approve
  await expect(record.locator('.act-handoff')).toContainText('cannot approve');
  await page.screenshot({ path: `${OUT}/agent-record-console.png`, fullPage: true });

  // The record travels into the human decision package
  await page.locator('.promote button').click();
  await expect(page.locator('.review-metrics')).toContainText('refused');
  const reviewRecord = page.locator('.agent-record');
  await expect(reviewRecord.locator('.act-row').first()).toBeVisible();

  // Before approval there is no human action in the record
  await expect(reviewRecord.locator('.act-row.act-human')).toHaveCount(0);

  // Approve: the run's single irreversible action, attributed to the human
  await page.locator('.approval-ack input[type="checkbox"]').check();
  await page.locator('.approval-actions .btn-primary').click();
  await expect(page.locator('.stamp')).toBeVisible({ timeout: 20_000 });
  const humanRow = reviewRecord.locator('.act-row.act-human');
  await expect(humanRow).toHaveCount(1, { timeout: 20_000 });
  await expect(humanRow).toContainText('Irreversible · human');
  await page.screenshot({ path: `${OUT}/agent-record-review.png`, fullPage: true });
});
