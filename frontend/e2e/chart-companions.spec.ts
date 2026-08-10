// Chart companions: ±2 SE bands, the exact-value side pane, and the
// provenance strip. House style: geometry and DOM assertions against the
// backend's completed run; screenshots are artifacts, not assertions.

import { test, expect } from '@playwright/test';

const AGE = '/?theme=light&noanim=1&exp=EXP-07&chart=age_curve';

test('the age curve carries a ±2 SE band that the toggle removes', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

  // band on by default, drawn behind the evidence marks
  await expect(card.locator('.chart-layer-uncertainty .se-band').first()).toBeVisible();
  const toggle = card.locator('.se-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await toggle.click();
  await expect(card.locator('.chart-layer-uncertainty .se-band')).toHaveCount(0);
  await toggle.click();
  await expect(card.locator('.chart-layer-uncertainty .se-band').first()).toBeVisible();
});

test('the reference age is exact and the thin tail is not', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

  // the value table is the precise surface: age 45 (the reference) shows no
  // interval, a thin-tail age shows its asymmetric range. It sits under the
  // chart card, beside it in the evidence panel, so the panel is the scope.
  const panel = page.locator('.selected-evidence');
  await panel.locator('.exact-values summary').click();
  const ref = panel.locator('.exact-values tr[data-x="45"]');
  const tail = panel.locator('.exact-values tr[data-x="85"]');
  await expect(ref).toBeVisible();
  await expect(ref.locator('td small')).toHaveCount(0);
  await expect(tail.locator('td small').first()).toContainText(' to ');
});

test('a table row pins the chart selection and the URL follows', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

  const panel = page.locator('.selected-evidence');
  await panel.locator('.exact-values summary').click();
  await panel.locator('.exact-values tr[data-x="70"] th button').click();
  await expect(card.locator('.selection-band')).toBeVisible();
  await expect(panel.locator('.exact-values tr[data-x="70"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/sel=70(%3A|:)70/);
});

test('the studio seats the value table where the reader puts it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${AGE}&full=1`);
  const full = page.locator('.chart-full');
  await expect(full).toBeVisible({ timeout: 90_000 });

  const pane = full.locator('.chart-table-pane');
  const plot = full.locator('.chart-full-body > svg');
  const place = (label: string) =>
    full.locator('.chart-place button', { hasText: new RegExp(`^${label}$`) });

  // Below is the default: the table starts under the plot, full width
  await expect(pane).toBeVisible();
  await expect(place('Below')).toHaveAttribute('aria-pressed', 'true');
  let plotBox = (await plot.boundingBox())!;
  let tableBox = (await pane.boundingBox())!;
  expect(tableBox.y).toBeGreaterThanOrEqual(plotBox.y + plotBox.height - 1);

  // Side: the pane starts right of the plot's end
  await place('Side').click();
  plotBox = (await plot.boundingBox())!;
  tableBox = (await pane.boundingBox())!;
  expect(tableBox.x).toBeGreaterThanOrEqual(plotBox.x + plotBox.width - 1);
  await expect(page).toHaveURL(/tbl=side/);

  // Only drops the plot, Off drops the table
  await place('Only').click();
  await expect(plot).toHaveCount(0);
  await expect(pane).toBeVisible();
  await place('Off').click();
  await expect(pane).toHaveCount(0);
  await expect(plot).toBeVisible();

  // the placement persists across a reload
  await page.goto(`${AGE}&full=1`);
  await expect(page.locator('.chart-full')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.chart-full .chart-table-pane')).toHaveCount(0);
});

test('an evidence link carries the placement it was copied at', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${AGE}&full=1&tbl=only`);
  const full = page.locator('.chart-full');
  await expect(full).toBeVisible({ timeout: 90_000 });
  await expect(full.locator('.chart-full-body > svg')).toHaveCount(0);
  await expect(full.locator('.chart-table-pane')).toBeVisible();
});

test('a pinned row narrows the copy to the selection', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`${AGE}&sel=70:70`);
  const panel = page.locator('.selected-evidence');
  await expect(panel.locator('.chart-workspace')).toBeVisible({ timeout: 90_000 });
  await panel.locator('.exact-values summary').click();

  // pinning is an act of narrowing, and the button says what it will take
  const copy = panel.locator('.exact-tool', { hasText: /^Copy 1 row$/ });
  await expect(copy).toBeVisible();
  await copy.click();
  const pasted: string = await page.evaluate(() => navigator.clipboard.readText());
  const lines = pasted.split('\r\n');
  expect(lines).toHaveLength(3); // provenance, header, the pinned row
  expect(lines[0]).toContain('1 of');
  expect(lines[0]).toContain('selected');
  expect(lines[2].startsWith('70\t')).toBe(true);
});

test('the full view survives a reload with the studio open', async ({ page }) => {
  // the StrictMode double-mount regression: a ?full=1 load must keep the
  // studio open instead of silently closing it after the second effect run
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${AGE}&full=1`);
  await expect(page.locator('.chart-full')).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(400);
  await expect(page.locator('.chart-full')).toBeVisible();
});

test('the companion strip names version, window, and the CI method while bands are up', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });

  const companion = card.locator('.chart-companion');
  await expect(companion).toContainText('v12');
  await expect(companion).toContainText('train');
  await expect(companion).toContainText('holdout');
  await expect(companion).toContainText('±2 SE');

  // the method line is owed exactly while the bands are on screen
  await card.locator('.se-toggle').click();
  await expect(companion).not.toContainText('±2 SE from the final fit weights');
});

test('the value grid sweeps a block of cells and the chart takes its rows', async ({ page }) => {
  await page.goto(AGE);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });
  const panel = page.locator('.selected-evidence');
  await panel.locator('.exact-values summary').click();

  const cell = (x: number, c: number) =>
    panel.locator(`.value-grid tr[data-x="${x}"] [data-c="${c}"]`);

  // the table scrolls inside a short window and its header sticks to the
  // top of it, so the sweep is centred: both ends on screen, neither under
  // the header
  await panel
    .locator('.value-grid tr[data-x="32"]')
    .evaluate((row) => row.scrollIntoView({ block: 'center' }));

  // press a cell and sweep: the block is the rectangle between the two cells
  const from = (await cell(31, 1).boundingBox())!;
  const to = (await cell(33, 2).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(cell(31, 1)).toHaveAttribute('data-in-range', '');
  await expect(cell(33, 2)).toHaveAttribute('data-in-range', '');
  // outside the swept columns and rows, nothing is in the block
  await expect(cell(32, 0)).not.toHaveAttribute('data-in-range', '');
  await expect(cell(34, 1)).not.toHaveAttribute('data-in-range', '');
  // no browser text selection was made in the process
  expect(await page.evaluate(() => String(getSelection()))).toBe('');

  // and the rows it covers are the chart's selection
  await expect(card.locator('.selection-label')).toContainText('31–33');
  await expect(page).toHaveURL(/sel=31(%3A|:)33/);

  // a single press collapses the block and the chart with it
  await cell(50, 2).click();
  await expect(cell(50, 2)).toHaveAttribute('data-in-range', '');
  await expect(cell(50, 1)).not.toHaveAttribute('data-in-range', '');
  await expect(card.locator('.selection-label')).toContainText('50');

  // chart→table: a selection made on the plot lights those rows whole-width
  await page.goto(`${AGE}&sel=60:62`);
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({ timeout: 90_000 });
  await panel.locator('.exact-values summary').click();
  await expect(cell(61, 0)).toHaveAttribute('data-in-range', '');
  await expect(cell(61, 2)).toHaveAttribute('data-in-range', '');
  await expect(cell(63, 2)).not.toHaveAttribute('data-in-range', '');
});

test('the value table leaves as tab-separated text and as a CSV file', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(AGE);
  const panel = page.locator('.selected-evidence');
  await expect(panel.locator('.chart-workspace')).toBeVisible({ timeout: 90_000 });
  await panel.locator('.exact-values summary').click();

  // copy: a spreadsheet paste leads with the provenance line, then the
  // headers, and the stacked cells arrive as their own numeric columns
  await panel.locator('.exact-tool', { hasText: 'Copy' }).click();
  await expect(panel.locator('.exact-tool').first()).toContainText('Copied');
  const pasted: string = await page.evaluate(() => navigator.clipboard.readText());
  const lines = pasted.split('\r\n');
  expect(lines[0]).toContain('EXP-07');
  expect(lines[0]).toMatch(/run .+ on v\d+/);
  const header = lines[1].split('\t');
  expect(header[0]).toMatch(/age/i);
  expect(header.some((cell) => /low \(-2 SE\)$/.test(cell))).toBe(true);
  expect(header.some((cell) => /high \(\+2 SE\)$/.test(cell))).toBe(true);
  expect(header).toContain('Share of exposure (%)');
  const row = lines.find((line) => line.startsWith('45\t'))!.split('\t');
  expect(row).toHaveLength(header.length);
  // every cell that carries a number carries only a number
  row.slice(1).filter(Boolean).forEach((cell) => expect(Number.isNaN(Number(cell))).toBe(false));

  // download: the same shape, comma separated, and the file is named for the
  // experiment, run and model version rather than for the chart alone
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.locator('.exact-tool', { hasText: 'Download CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^exp-07-.*-run-.*-v\d+\.csv$/);
  const stream = await download.createReadStream();
  const csv = await new Promise<string>((resolve, reject) => {
    let text = '';
    stream.on('data', (chunk) => (text += chunk));
    stream.on('end', () => resolve(text));
    stream.on('error', reject);
  });
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  // the same provenance line, CSV-quoted if it happens to hold a comma
  expect(csv.split('\r\n')[0].replace('﻿', '').replace(/^"|"$/g, '').replace(/""/g, '"')).toBe(
    lines[0],
  );
  expect(csv.split('\r\n')[1]).toBe(header.join(','));
  expect(csv.split('\r\n')).toHaveLength(lines.length);
});

test('scroll surfaces wear the theme, not the operating system', async ({ page }) => {
  await page.goto(AGE);
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({ timeout: 90_000 });
  await page.locator('.exact-values summary').click();

  // the bar is drawn by the app: a thumb mixed from the theme's own ink, and
  // no platform stepper arrows
  const read = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const rules = Array.from(document.styleSheets)
        .flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules);
          } catch {
            return [];
          }
        })
        .map((rule) => rule.cssText);
      return {
        thumb: root.getPropertyValue('--scroll-thumb').trim(),
        thumbRule: rules.some((text) => text.startsWith('::-webkit-scrollbar-thumb')),
        noArrows: rules.some(
          (text) => text.startsWith('::-webkit-scrollbar-button') && text.includes('none'),
        ),
      };
    });
  const light = await read();
  expect(light.thumb).not.toBe('');
  expect(light.thumbRule).toBe(true);
  expect(light.noArrows).toBe(true);

  // and it follows the theme, because it is mixed from that theme's text color
  await page.goto('/?theme=dark&noanim=1&exp=EXP-07&chart=age_curve');
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({ timeout: 90_000 });
  const dark = await read();
  expect(dark.thumb).not.toBe(light.thumb);
});

test('territory carries its exposure series with the filed dots', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1&exp=EXP-03&chart=territory');
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.locator('.legend')).toContainText('Share of exposure');
});

test('a pinned banded point reads out its interval', async ({ page }) => {
  await page.goto(`${AGE}&sel=80:80`);
  const card = page.locator('.selected-evidence .chart-workspace');
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.locator('.selection-values')).toContainText(' to ');
});
