import { expect, test, type Page } from '@playwright/test';

const ROUTE = '/actuarial-research-system.html';
const CHART_ROUTE = '/actuarial-ux-chart-loop.html';

async function openPoster(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(ROUTE);
  await expect(page).toHaveTitle('Actuarial UX Research System');

  const frame = page.frameLocator('iframe[title="Actuarial UX Research System"]');
  await expect(frame.locator('#ars-poster')).toBeVisible();
  return frame;
}

async function readLayout(page: Page) {
  const frame = page.frameLocator('iframe[title="Actuarial UX Research System"]');
  return frame.locator('#ars-poster').evaluate((poster) => {
    const stages = Array.from(poster.querySelectorAll<HTMLElement>('.ars-stage'));
    const overflow = stages.map((stage) => {
      const output = stage.querySelector<HTMLElement>('.ars-output');
      if (!output) return 0;
      return Math.max(0, output.getBoundingClientRect().bottom - stage.getBoundingClientRect().bottom);
    });

    const label = poster.querySelector<HTMLElement>('.ars-label');
    const title = poster.querySelector<HTMLElement>('.ars-title');
    const documentElement = poster.ownerDocument.documentElement;
    const collisions = stages.map((stage) => {
      const copy = stage.querySelector<HTMLElement>('.ars-copy');
      const output = stage.querySelector<HTMLElement>('.ars-output');
      if (!copy || !output) return 0;
      const contentBottom = Math.max(
        ...Array.from(copy.children).map((child) => child.getBoundingClientRect().bottom),
      );
      return Math.max(0, contentBottom - output.getBoundingClientRect().top);
    });
    return {
      bodyFont: Number(getComputedStyle(poster).fontSize.replace('px', '')),
      labelFont: label ? Number(getComputedStyle(label).fontSize.replace('px', '')) : 0,
      titleTop: title?.getBoundingClientRect().top ?? 0,
      maxCopyCollision: Math.max(...collisions),
      maxStageOverflow: Math.max(...overflow),
      documentOverflow: documentElement.scrollHeight - documentElement.clientHeight,
    };
  });
}

async function openChartLoop(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto(CHART_ROUTE);
  await expect(page).toHaveTitle('Prediction Lab UX and Chart Workspace Loop');

  const frame = page.frameLocator('iframe[title="Prediction Lab UX and Chart Workspace Loop"]');
  await expect(frame.locator('#ux-chart-loop')).toBeVisible();
  return frame;
}

async function readChartLayout(page: Page) {
  const frame = page.frameLocator('iframe[title="Prediction Lab UX and Chart Workspace Loop"]');
  return frame.locator('#ux-chart-loop').evaluate((poster) => {
    const stages = Array.from(poster.querySelectorAll<HTMLElement>('.ucl-stage'));
    const overflow = stages.map((stage) => {
      const output = stage.querySelector<HTMLElement>('.ucl-output');
      if (!output) return 0;
      return Math.max(0, output.getBoundingClientRect().bottom - stage.getBoundingClientRect().bottom);
    });

    const label = poster.querySelector<HTMLElement>('.ucl-label');
    const title = poster.querySelector<HTMLElement>('.ucl-title');
    const documentElement = poster.ownerDocument.documentElement;
    const collisions = stages.map((stage) => {
      const copy = stage.querySelector<HTMLElement>('.ucl-copy');
      const output = stage.querySelector<HTMLElement>('.ucl-output');
      if (!copy || !output) return 0;
      const contentBottom = Math.max(
        ...Array.from(copy.children).map((child) => child.getBoundingClientRect().bottom),
      );
      return Math.max(0, contentBottom - output.getBoundingClientRect().top);
    });
    return {
      bodyFont: Number(getComputedStyle(poster).fontSize.replace('px', '')),
      labelFont: label ? Number(getComputedStyle(label).fontSize.replace('px', '')) : 0,
      titleTop: title?.getBoundingClientRect().top ?? 0,
      maxCopyCollision: Math.max(...collisions),
      maxStageOverflow: Math.max(...overflow),
      documentOverflow: documentElement.scrollHeight - documentElement.clientHeight,
    };
  });
}

test('standalone poster uses larger type and a clean review connector', async ({ page }) => {
  const frame = await openPoster(page, 1920, 1080);
  const layout = await readLayout(page);

  expect(layout.bodyFont).toBeGreaterThanOrEqual(17);
  expect(layout.labelFont).toBeGreaterThanOrEqual(14);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);

  await expect(frame.locator('path[d="M181 55 H241"]')).toHaveCount(1);
  await expect(frame.locator('path[d="M181 55 H270"]')).toHaveCount(0);
});

test('compact-height poster stays readable and contained', async ({ page }) => {
  await openPoster(page, 1280, 720);
  const layout = await readLayout(page);

  expect(layout.bodyFont).toBeGreaterThanOrEqual(14);
  expect(layout.labelFont).toBeGreaterThanOrEqual(14);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
  const ctaBottom = await page.locator('.page-switch').evaluate(
    (link) => link.getBoundingClientRect().bottom,
  );
  expect(ctaBottom).toBeLessThanOrEqual(layout.titleTop);
});

test('chart-loop poster uses larger type and stays contained', async ({ page }) => {
  await openChartLoop(page, 1920, 1080);
  const layout = await readChartLayout(page);

  expect(layout.bodyFont).toBeGreaterThanOrEqual(16);
  expect(layout.labelFont).toBeGreaterThanOrEqual(14);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
});

test('compact chart-loop poster stays readable and contained', async ({ page }) => {
  await openChartLoop(page, 1280, 720);
  const layout = await readChartLayout(page);

  expect(layout.bodyFont).toBeGreaterThanOrEqual(14);
  expect(layout.labelFont).toBeGreaterThanOrEqual(14);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
  const ctaBottom = await page.locator('.page-switch').evaluate(
    (link) => link.getBoundingClientRect().bottom,
  );
  expect(ctaBottom).toBeLessThanOrEqual(layout.titleTop);
});

test('standalone posters link to each other without covering the title', async ({ page }) => {
  const researchFrame = await openPoster(page, 1920, 1080);
  const researchCta = page.getByRole('link', {
    name: 'Explore the actuarial UX chart workspace loop',
  });
  await expect(researchCta).toHaveAttribute('href', CHART_ROUTE);
  const researchCtaBottom = await researchCta.evaluate((link) => link.getBoundingClientRect().bottom);
  const researchTitleTop = await researchFrame.locator('.ars-title').evaluate(
    (title) => title.getBoundingClientRect().top,
  );
  expect(researchCtaBottom).toBeLessThanOrEqual(researchTitleTop);

  await researchCta.click();
  await expect(page).toHaveURL(new RegExp(`${CHART_ROUTE}$`));
  await expect(page).toHaveTitle('Prediction Lab UX and Chart Workspace Loop');

  const chartCta = page.getByRole('link', {
    name: 'Explore the actuarial UX research system',
  });
  await expect(chartCta).toHaveAttribute('href', ROUTE);
  const chartLayout = await readChartLayout(page);
  const chartCtaBottom = await chartCta.evaluate((link) => link.getBoundingClientRect().bottom);
  expect(chartCtaBottom).toBeLessThanOrEqual(chartLayout.titleTop);

  await chartCta.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`));
  await expect(page).toHaveTitle('Actuarial UX Research System');
});
