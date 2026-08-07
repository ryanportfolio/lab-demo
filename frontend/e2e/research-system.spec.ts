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
    const header = poster.querySelector<HTMLElement>('.ars-top');
    const heading = header?.firstElementChild as HTMLElement | null;
    const thesis = poster.querySelector<HTMLElement>('.ars-thesis');
    const cta = poster.querySelector<HTMLElement>('.ars-switch');
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
      ctaFont: cta ? Number(getComputedStyle(cta).fontSize.replace('px', '')) : 0,
      ctaHeight: cta?.getBoundingClientRect().height ?? 0,
      headerOverflow: header
        ? Math.max(
            0,
            ...[cta, thesis]
              .filter((item) => item && getComputedStyle(item).display !== 'none')
              .map((item) => item!.getBoundingClientRect().bottom - header.getBoundingClientRect().bottom),
          )
        : 0,
      ctaGapFromTitle: cta && heading
        ? cta.getBoundingClientRect().left - heading.getBoundingClientRect().right
        : 0,
      thesisGapFromCta: cta && thesis && getComputedStyle(thesis).display !== 'none'
        ? thesis.getBoundingClientRect().left - cta.getBoundingClientRect().right
        : 0,
      thesisWidth: thesis && getComputedStyle(thesis).display !== 'none'
        ? thesis.getBoundingClientRect().width
        : 0,
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
    const header = poster.querySelector<HTMLElement>('.ucl-top');
    const heading = header?.firstElementChild as HTMLElement | null;
    const thesis = poster.querySelector<HTMLElement>('.ucl-thesis');
    const cta = poster.querySelector<HTMLElement>('.ucl-switch');
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
      ctaFont: cta ? Number(getComputedStyle(cta).fontSize.replace('px', '')) : 0,
      ctaHeight: cta?.getBoundingClientRect().height ?? 0,
      headerOverflow: header
        ? Math.max(
            0,
            ...[cta, thesis]
              .filter((item) => item && getComputedStyle(item).display !== 'none')
              .map((item) => item!.getBoundingClientRect().bottom - header.getBoundingClientRect().bottom),
          )
        : 0,
      ctaGapFromTitle: cta && heading
        ? cta.getBoundingClientRect().left - heading.getBoundingClientRect().right
        : 0,
      thesisGapFromCta: cta && thesis && getComputedStyle(thesis).display !== 'none'
        ? thesis.getBoundingClientRect().left - cta.getBoundingClientRect().right
        : 0,
      thesisWidth: thesis && getComputedStyle(thesis).display !== 'none'
        ? thesis.getBoundingClientRect().width
        : 0,
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
  expect(layout.ctaFont).toBeGreaterThanOrEqual(15);
  expect(layout.ctaHeight).toBeGreaterThanOrEqual(44);
  expect(layout.headerOverflow).toBeLessThanOrEqual(1);
  expect(layout.ctaGapFromTitle).toBeGreaterThanOrEqual(18);
  expect(layout.thesisGapFromCta).toBeGreaterThanOrEqual(18);
  expect(layout.thesisWidth).toBeGreaterThanOrEqual(330);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
  await expect(frame.locator('body')).not.toContainText('—');

  const researchSkillLinks = frame.getByRole('link', {
    name: 'researching-actuarial-ux',
    exact: true,
  });
  await expect(researchSkillLinks).toHaveCount(2);
  for (const link of await researchSkillLinks.all()) {
    await expect(link).toHaveAttribute(
      'href',
      'https://github.com/ryanportfolio/lab-demo/blob/main/.claude/skills/researching-actuarial-ux/SKILL.md',
    );
    await expect(link).toHaveAttribute('target', '_top');
    const fontWeight = await link.evaluate((element) => Number(getComputedStyle(element).fontWeight));
    expect(fontWeight).toBeGreaterThanOrEqual(700);
  }

  const reviewSkillLink = frame.getByRole('link', {
    name: 'reviewing-actuarial-ux-syntheses',
    exact: true,
  });
  await expect(reviewSkillLink).toHaveAttribute(
    'href',
    'https://github.com/ryanportfolio/lab-demo/blob/main/.claude/skills/reviewing-actuarial-ux-syntheses/SKILL.md',
  );
  await expect(reviewSkillLink).toHaveAttribute('target', '_top');
  const reviewFontWeight = await reviewSkillLink.evaluate((element) =>
    Number(getComputedStyle(element).fontWeight),
  );
  expect(reviewFontWeight).toBeGreaterThanOrEqual(700);

  await expect(frame.locator('path[d="M181 55 H241"]')).toHaveCount(1);
  await expect(frame.locator('path[d="M181 55 H270"]')).toHaveCount(0);
});

test('compact-height poster stays readable and contained', async ({ page }) => {
  await openPoster(page, 1280, 720);
  const layout = await readLayout(page);

  expect(layout.bodyFont).toBeGreaterThanOrEqual(14);
  expect(layout.labelFont).toBeGreaterThanOrEqual(14);
  expect(layout.ctaFont).toBeGreaterThanOrEqual(14);
  expect(layout.ctaHeight).toBeGreaterThanOrEqual(36);
  expect(layout.headerOverflow).toBeLessThanOrEqual(1);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
});

test('chart-loop poster uses larger type and stays contained', async ({ page }) => {
  const frame = await openChartLoop(page, 1920, 1080);
  const layout = await readChartLayout(page);

  expect(layout.bodyFont).toBeGreaterThanOrEqual(16);
  expect(layout.labelFont).toBeGreaterThanOrEqual(14);
  expect(layout.ctaFont).toBeGreaterThanOrEqual(15);
  expect(layout.ctaHeight).toBeGreaterThanOrEqual(44);
  expect(layout.headerOverflow).toBeLessThanOrEqual(1);
  expect(layout.ctaGapFromTitle).toBeGreaterThanOrEqual(18);
  expect(layout.thesisGapFromCta).toBeGreaterThanOrEqual(18);
  expect(layout.thesisWidth).toBeGreaterThanOrEqual(330);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
  await expect(frame.locator('body')).not.toContainText('—');

  await expect(frame.locator('.ucl-title')).not.toContainText('.');
  const skillLinks = [
    {
      name: 'prediction-lab-actuarial-ux',
      href: 'https://github.com/ryanportfolio/lab-demo/blob/main/.claude/skills/prediction-lab-actuarial-ux/SKILL.md',
    },
    {
      name: 'designing-actuarial-chart-workspaces',
      href: 'https://github.com/ryanportfolio/lab-demo/blob/main/.claude/skills/designing-actuarial-chart-workspaces/SKILL.md',
    },
  ];
  for (const skill of skillLinks) {
    const link = frame.getByRole('link', { name: skill.name, exact: true });
    await expect(link).toHaveAttribute('href', skill.href);
    await expect(link).toHaveAttribute('target', '_top');
    const fontWeight = await link.evaluate((element) => Number(getComputedStyle(element).fontWeight));
    expect(fontWeight).toBeGreaterThanOrEqual(700);
  }
});

test('compact chart-loop poster stays readable and contained', async ({ page }) => {
  await openChartLoop(page, 1280, 720);
  const layout = await readChartLayout(page);

  expect(layout.bodyFont).toBeGreaterThanOrEqual(14);
  expect(layout.labelFont).toBeGreaterThanOrEqual(14);
  expect(layout.ctaFont).toBeGreaterThanOrEqual(14);
  expect(layout.ctaHeight).toBeGreaterThanOrEqual(36);
  expect(layout.headerOverflow).toBeLessThanOrEqual(1);
  expect(layout.maxCopyCollision).toBeLessThanOrEqual(1);
  expect(layout.maxStageOverflow).toBeLessThanOrEqual(1);
  expect(layout.documentOverflow).toBeLessThanOrEqual(1);
});

test('standalone posters use prominent inline links to navigate between systems', async ({ page }) => {
  const researchFrame = await openPoster(page, 1920, 1080);
  const researchCta = researchFrame.getByRole('link', {
    name: 'Explore the actuarial UX chart workspace loop',
  });
  await expect(researchCta).toHaveAttribute('href', CHART_ROUTE);
  await expect(researchCta).toHaveAttribute('target', '_top');

  await researchCta.click();
  await expect(page).toHaveURL(new RegExp(`${CHART_ROUTE}$`));
  await expect(page).toHaveTitle('Prediction Lab UX and Chart Workspace Loop');

  const chartFrame = page.frameLocator('iframe[title="Prediction Lab UX and Chart Workspace Loop"]');
  const chartCta = chartFrame.getByRole('link', {
    name: 'Explore the actuarial UX research system',
  });
  await expect(chartCta).toHaveAttribute('href', ROUTE);
  await expect(chartCta).toHaveAttribute('target', '_top');

  await chartCta.click();
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`));
  await expect(page).toHaveTitle('Actuarial UX Research System');
});
