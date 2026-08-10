import { expect, test, type Page } from '@playwright/test';

// The studio's chart navigator: every chart in the run on the left edge,
// searchable, pinnable, user-set density, all saved on this browser.

async function openStudio(page: Page) {
  await page.goto('/?theme=light&noanim=1');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  await expect(page.locator('.chart-studio-rail')).toBeVisible();
}

test.use({ viewport: { width: 1500, height: 1000 } });

test('the navigator lists every experiment and swaps charts without closing the studio', async ({ page }) => {
  await openStudio(page);

  const nav = page.locator('.snav');
  await expect(nav).toBeVisible();
  await expect(nav).not.toHaveAttribute('data-collapsed', 'true');
  // every landed experiment appears as a section
  for (const code of ['EXP-01', 'EXP-02', 'EXP-03', 'EXP-04', 'EXP-05', 'EXP-06', 'EXP-07']) {
    await expect(nav.locator('.snav-sect', { hasText: code })).toBeVisible({ timeout: 20_000 });
  }
  // the open chart is marked active
  await expect(nav.locator('.snav-item[data-active]')).toContainText('age relativity');

  // navigating to another experiment's chart swaps the pane, studio stays up
  await nav.locator('.snav-open', { hasText: 'Filed against blended relativity' }).click();
  const full = page.locator('.chart-full');
  await expect(full).toBeVisible();
  await expect(full).toHaveAttribute('data-kind', 'territory', { timeout: 20_000 });
  await expect(full.locator('.chart-source')).toContainText('EXP-03');
  await expect(page).toHaveURL(/exp=EXP-03/);
  await expect(page).toHaveURL(/chart=territory/);
  await expect(page).toHaveURL(/full=1/);
  await expect(nav.locator('.snav-item[data-active]')).toContainText('Filed against blended relativity');
});

test('search filters, pins float, density is user-set, and all of it persists', async ({ page }) => {
  await openStudio(page);
  const nav = page.locator('.snav');
  await expect(nav.locator('.snav-sect', { hasText: 'EXP-06' })).toBeVisible({ timeout: 20_000 });

  // search narrows the list and hides non-matching sections
  await nav.locator('.snav-search input').fill('missing');
  await expect(nav.locator('.snav-sect', { hasText: 'EXP-01' })).toHaveCount(0);
  await expect(nav.locator('.snav-open', { hasText: 'Missing mileage by region' })).toBeVisible();
  await nav.locator('.snav-search input').fill('');

  // density cycles compact -> info
  await expect(nav).toHaveAttribute('data-density', 'compact');
  await nav.locator('.snav-density').click();
  await expect(nav).toHaveAttribute('data-density', 'info');

  // pin a chart: it floats into the Pinned section
  await nav
    .locator('.snav-item', { hasText: 'Change in separation by fold' })
    .first()
    .locator('.snav-star')
    .click();
  await expect(nav.locator('.snav-label', { hasText: 'Pinned' })).toBeVisible();

  // preferences survive a reload (saved on this browser)
  await page.goto(page.url());
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.chart-studio-rail')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.snav')).toHaveAttribute('data-density', 'info');
  await expect(page.locator('.snav-label', { hasText: 'Pinned' })).toBeVisible({ timeout: 20_000 });
});

test('pinned rows are closed by a rule, and the controls name themselves on hover', async ({ page }) => {
  await openStudio(page);
  const nav = page.locator('.snav');
  await expect(nav.locator('.snav-sect', { hasText: 'EXP-01' })).toBeVisible({ timeout: 20_000 });

  // no pins, no divider; a pin brings the section and the rule with it
  await expect(nav.locator('.snav-rule')).toHaveCount(0);
  await nav.locator('.snav-item').first().locator('.snav-star').click();
  await expect(nav.locator('.snav-label', { hasText: 'Pinned' })).toBeVisible();
  const rule = nav.locator('.snav-rule');
  await expect(rule).toHaveCount(1);
  // it sits under the pinned rows and above the first experiment group
  const order = await nav.locator('.snav-list').evaluate((list) => {
    const kids = Array.from(list.children);
    return {
      rule: kids.findIndex((k) => k.classList.contains('snav-rule')),
      label: kids.findIndex((k) => k.classList.contains('snav-label')),
      group: kids.findIndex((k) => k.classList.contains('snav-group')),
    };
  });
  expect(order.label).toBeLessThan(order.rule);
  expect(order.rule).toBeLessThan(order.group);

  // tooltips are the app's own and arrive at once, not after the browser's wait
  await nav.locator('.snav-toggle').hover();
  await expect(page.locator('.hint')).toHaveText('Hide the chart list', { timeout: 400 });
  await nav.locator('.snav-density').hover();
  await expect(page.locator('.hint')).toContainText('Row detail: titles only', { timeout: 400 });
  await nav.locator('.snav-item').first().locator('.snav-star').hover();
  await expect(page.locator('.hint')).toContainText('Unpin', { timeout: 400 });
  // and they leave with the pointer
  await page.locator('.chart-full-split figcaption').hover();
  await expect(page.locator('.hint')).toHaveCount(0);
});

test('the navigator collapses to a strip and starts collapsed on tighter viewports', async ({ page }) => {
  await openStudio(page);
  const nav = page.locator('.snav');
  await nav.locator('.snav-toggle').click();
  await expect(nav).toHaveAttribute('data-collapsed', 'true');
  await expect(nav.locator('.snav-list')).toHaveCount(0);
  await nav.locator('.snav-toggle').click();
  await expect(nav).not.toHaveAttribute('data-collapsed', 'true');
});

test('a 1280 viewport starts the navigator as a strip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto('/?theme=light&noanim=1');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"] .expand').click();
  await expect(page.locator('.chart-studio-rail')).toBeVisible();
  await expect(page.locator('.snav')).toHaveAttribute('data-collapsed', 'true');
});
