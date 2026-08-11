// The inspector rail is the run's standing head: premises agreed before it,
// guardrails checked while it ran, where it stands now. Two things it must
// keep doing — put every claim's source on the page rather than behind a
// hover, and let a guardrail that stopped an experiment lead you to that
// experiment — plus one thing it must not do again: compress the approval
// card until its own Approve button falls outside the rail.

import { expect, test } from '@playwright/test';

test('a guardrail names the experiment it stopped, on the page and as a way in', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?theme=light&noanim=1');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });

  const checks = page.locator('.rail-check');
  await expect(checks).toHaveCount(3);

  // Every premise carries its provenance as text. The rail used to hold all of
  // it in title attributes, which a touch reader never reaches.
  const sources = page.locator('.context-strip .rail-source');
  expect(await sources.count()).toBeGreaterThanOrEqual(4);
  await expect(sources.first()).toBeVisible();

  // A completed run scraps experiments, so at least one rail carries a cost.
  // Which ones depends on the run, so the test finds them instead of naming
  // them.
  const costs = page.locator('.rail-cost button');
  const costCount = await costs.count();
  expect(costCount).toBeGreaterThan(0);

  const label = (await costs.first().innerText()).trim();
  const code = label.match(/EXP-\d+/)?.[0];
  expect(code, `cost line "${label}" should name an experiment`).toBeTruthy();

  await costs.first().click();
  await expect(page.locator('.ledger-row.selected')).toContainText(code!);
  await expect(page).toHaveURL(new RegExp(`exp=${code}`));
  await expect(page.locator('.selected-evidence')).toContainText(code!);
});

test('in review the rail leads with the decision and keeps Approve inside its box', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?theme=light&noanim=1');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: /decision package/i }).click();
  await expect(page.locator('.approval-sheet')).toBeVisible({ timeout: 30_000 });

  // Read and placed the same way: the card that carries the checkbox gating
  // Approve is the rail's first child, not something below three registers.
  const leadsWithDecision = await page.evaluate(
    () =>
      document
        .querySelector('.context-strip')
        ?.firstElementChild?.classList.contains('approval-sheet') ?? false,
  );
  expect(leadsWithDecision).toBe(true);

  // The foot holds Approve while the review is open and the decision record
  // once it is approved; either way it is the card's last row, so it is the
  // thing that must land inside the rail's box.
  const geometry = await page.evaluate(() => {
    const rail = document.querySelector('.context-strip')!;
    const sheet = document.querySelector('.approval-sheet')!;
    const foot = document.querySelector('.approval-sheet .approval-foot')!;
    return {
      railBottom: rail.getBoundingClientRect().bottom,
      footBottom: foot.getBoundingClientRect().bottom,
      sheetBox: sheet.clientHeight,
      sheetContent: sheet.scrollHeight,
    };
  });

  // The card is never squeezed to make the rail fit. As a shrinkable flex
  // child it was: its box collapsed, its content spilled past it, the rail
  // reported no overflow and grew no scrollbar, and Approve ended up outside
  // the rail with no way to reach it.
  expect(geometry.sheetContent).toBeLessThanOrEqual(geometry.sheetBox + 1);
  expect(geometry.footBottom).toBeLessThanOrEqual(geometry.railBottom);
});
