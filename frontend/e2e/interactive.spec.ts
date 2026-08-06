// The interactive chart layer: hover reads the stored number back exactly,
// a click opens the full view, the legend turns series off, and Escape
// unwinds one layer at a time.

import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = '../.tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

async function ready(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
}

/** Same trimming the renderer uses; the head and row assertions below hold
 *  the two implementations together */
function fmtVal(y: number): string {
  if (Number.isInteger(y)) return String(y);
  const a = Math.abs(y);
  if (a >= 100) return y.toFixed(1);
  if (a >= 10) return y.toFixed(2);
  return y.toFixed(3);
}

interface ExpectedChart {
  kind: string;
  headText: string;
  values: number[];
  secondaryValues: number[];
  series: { label: string; style: string; secondary: boolean }[];
}

/** Read the winner's first multi-series chart straight from the API, and the
 *  values every series holds at the first x on the axis */
async function expectedFromApi(page: Page): Promise<ExpectedChart> {
  return page.evaluate(async () => {
    const gq = async (query: string, variables: Record<string, unknown> = {}) => {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-actor-role': 'human' },
        body: JSON.stringify({ query, variables }),
      });
      return (await res.json()).data;
    };
    const run = (await gq('query { latestRun { id winnerCode } }')).latestRun;
    const ev = (
      await gq(
        `query($runId: ID!, $code: String!) {
          evidence(runId: $runId, code: $code) {
            charts { kind xLabel series { label style points { x y label } } }
          }
        }`,
        { runId: run.id, code: run.winnerCode },
      )
    ).evidence;
    const isSecondary = (label: string) =>
      label === 'Earned exposure' || label.startsWith('Share of exposure');
    const chart = ev.charts.find(
      (c: { series: unknown[] }) => c.series.length >= 2,
    );
    const primary = chart.series.filter(
      (s: { label: string }) => !isSecondary(s.label),
    );
    const secondary = chart.series.filter((s: { label: string }) =>
      isSecondary(s.label),
    );
    const xs = [
      ...new Set(
        chart.series.flatMap((s: { points: { x: number }[] }) =>
          s.points.map((p) => p.x),
        ),
      ),
    ].sort((a: number, b: number) => a - b);
    const x0 = xs[0];
    const at = (s: { points: { x: number; y: number; label: string | null }[] }) =>
      s.points.find((p) => Math.abs(p.x - x0) < 1e-9);
    // mirror the renderer's axis-style detection to predict the head text
    const categorical =
      primary.some(
        (s: any) =>
          s.points.length > 0 && s.points.every((p: any) => p.label != null),
      ) &&
      primary.every((s: any) => s.points.length <= 32) &&
      primary
        .flatMap((s: any) => s.points.map((p: any) => p.x))
        .every((x: number) => Number.isInteger(x));
    const bandLabel = primary
      .flatMap((s: any) => s.points)
      .find((p: any) => Math.abs(p.x - x0) < 1e-9 && p.label != null)?.label;
    return {
      kind: chart.kind,
      headText: categorical && bandLabel ? bandLabel : `${chart.xLabel} ${x0}`,
      values: primary.flatMap((s: any) => {
        const p = at(s);
        return p ? [p.y] : [];
      }),
      secondaryValues: secondary.flatMap((s: any) => {
        const p = at(s);
        return p ? [p.y] : [];
      }),
      series: chart.series.map((s: any) => ({
        label: s.label,
        style: s.style,
        secondary: isSecondary(s.label),
      })),
    };
  });
}

test('the hover readout shows the stored artifact values exactly', async ({
  page,
}) => {
  await page.goto('/?theme=light');
  await ready(page);
  await page.locator('.exp.win .open-ev').click();
  await expect(page.locator('.exp.win .chart svg').first()).toBeVisible({
    timeout: 20_000,
  });

  const want = await expectedFromApi(page);
  // a chart with nothing to read at the first x would gate nothing
  expect(want.values.length).toBeGreaterThan(0);
  const chart = page.locator(`.exp.win .chart[data-kind="${want.kind}"]`);
  const svg = page.locator(`.exp.win .chart[data-kind="${want.kind}"] > svg`);
  await svg.focus();
  // the first arrow press lands the readout on the first x of the axis
  await page.keyboard.press('ArrowRight');

  const tip = chart.locator('.tip');
  await expect(tip).toBeVisible();
  const txt = (await tip.textContent()) ?? '';
  expect(txt, 'head captions the hovered position').toContain(want.headText);
  for (const y of want.values) {
    expect(txt, `readout should carry ${y}`).toContain(fmtVal(y));
  }
  for (const y of want.secondaryValues) {
    expect(txt, `readout should carry exposure ${y}`).toContain(y.toFixed(1));
  }
  // one row per series that holds a point at this x, no more, no fewer
  expect(await tip.locator('> g').count()).toBe(
    want.values.length + want.secondaryValues.length,
  );
  expect(txt).not.toContain('—');
  await chart.screenshot({ path: `${OUT}/interactive-hover-light.png` });

  // Escape clears the readout without touching anything else
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});

test('a chart opens full screen, locks the page, and its legend toggles series', async ({
  page,
}) => {
  await page.goto('/?theme=light');
  await ready(page);
  await page.locator('.exp.win .open-ev').click();
  await expect(page.locator('.exp.win .chart svg').first()).toBeVisible({
    timeout: 20_000,
  });

  const want = await expectedFromApi(page);
  await page.locator(`.exp.win .chart[data-kind="${want.kind}"] > svg`).click();
  const full = page.locator('.chart-full');
  await expect(full).toBeVisible();
  await expect(full.locator('svg')).toBeVisible();

  // the page underneath holds still while the full view is up
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(20, 400);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  // the palette shortcut stands down while a chart holds the full screen,
  // so the two scroll locks can never cross
  await page.keyboard.press('Control+k');
  await expect(page.locator('.ask')).toBeHidden();

  // arrow keys walk the axis in the full view too
  await page.keyboard.press('ArrowRight');
  await expect(full.locator('.tip')).toBeVisible();
  await page.screenshot({ path: `${OUT}/interactive-full-light.png` });

  // a legend entry removes its series from the drawing, not just its button
  const drawn = want.series.find(
    (s) => !s.secondary && (s.style === 'line' || s.style === 'step'),
  );
  expect(drawn).toBeTruthy();
  const btn = full.locator('.legend button', { hasText: drawn!.label });
  const pathsBefore = await full.locator('svg path').count();
  await btn.click();
  await expect(btn).toHaveClass(/off/);
  expect(await full.locator('svg path').count()).toBeLessThan(pathsBefore);
  await page.screenshot({ path: `${OUT}/interactive-toggled-light.png` });
  await btn.click();
  await expect(btn).not.toHaveClass(/off/);
  expect(await full.locator('svg path').count()).toBe(pathsBefore);

  // the last visible result series cannot be turned off: its button says so
  const primaries = want.series.filter((s) => !s.secondary);
  for (const s of primaries.slice(0, -1)) {
    await full.locator('.legend button', { hasText: s.label }).click();
  }
  const lastBtn = full.locator('.legend button', {
    hasText: primaries[primaries.length - 1].label,
  });
  await expect(lastBtn).toBeDisabled();
  for (const s of primaries.slice(0, -1)) {
    await full.locator('.legend button', { hasText: s.label }).click();
  }
  await expect(lastBtn).toBeEnabled();

  // Escape closes the full view, only the full view, and hands scroll back
  await page.keyboard.press('Escape');
  await expect(page.locator('.chart-scrim')).toBeHidden();
  await expect(page.locator('.exp.win .evidence')).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

test('a chart inside the palette expands above it and Escape unwinds in order', async ({
  page,
}) => {
  await page.goto('/?theme=dark');
  await ready(page);
  await page.locator('.askbtn').click();
  await expect(page.locator('.ask')).toBeVisible();
  await page.locator('.ask-sugg button').first().click();
  await expect(page.locator('.ask-row.ai .chart > svg').first()).toBeVisible({
    timeout: 30_000,
  });

  await page.locator('.ask-row.ai .chart > svg').first().click();
  await expect(page.locator('.chart-full')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.chart-full .tip')).toBeVisible();
  await page.screenshot({ path: `${OUT}/interactive-ask-full-dark.png` });

  // first Escape closes the chart, the palette stays
  await page.keyboard.press('Escape');
  await expect(page.locator('.chart-scrim')).toBeHidden();
  await expect(page.locator('.ask')).toBeVisible();

  // the next Escape closes the palette as before
  await page.keyboard.press('Escape');
  await expect(page.locator('.ask')).toBeHidden();
});

test('the review draws the model diff from the winner artifacts', async ({
  page,
}) => {
  await page.goto('/?theme=light');
  await ready(page);
  // the in-app route change keeps the frozen capture state
  await page.evaluate(() => {
    location.hash = 'review';
  });
  await expect(page.locator('.rv-head')).toBeVisible({ timeout: 30_000 });

  const diff = page.locator('.rv-sect .evidence');
  await expect(diff).toBeVisible({ timeout: 20_000 });
  await expect(diff.locator('.facts')).toContainText('training rows');
  await expect(
    diff.locator('.chart', { hasText: 'Actual frequency by risk decile' }),
  ).toBeVisible();
  expect(await diff.locator('.chart').count()).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: `${OUT}/review-diff-light.png`, fullPage: true });
});
