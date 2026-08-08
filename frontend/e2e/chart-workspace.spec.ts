import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await page.evaluate(() => (window as any).__capture.freeze());
  await page.locator('.ledger-row', { hasText: 'EXP-07' }).click();
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({
    timeout: 20_000,
  });
}

test('every evidence chart states its question and visible weak point', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const expected: Record<string, number> = {
    'EXP-01': 3,
    'EXP-02': 3,
    'EXP-03': 3,
    'EXP-04': 3,
    'EXP-05': 3,
    'EXP-06': 2,
    'EXP-07': 4,
  };
  for (const [code, count] of Object.entries(expected)) {
    await page.locator('.ledger-row', { hasText: code }).click();
    await expect(page.locator('.selected-evidence .evidence-head')).toContainText(code);
    const tabs = page.locator('.selected-evidence .evidence-tabs button');
    await expect(tabs).toHaveCount(count);
    for (let index = 0; index < count; index++) {
      await tabs.nth(index).click();
      await expect(page.locator('.selected-evidence .chart-question')).not.toBeEmpty();
      await expect(page.locator('.selected-evidence .chart-weakness')).not.toBeEmpty();
      await expect(page.locator('.selected-evidence .chart-source')).toContainText('BI claims / earned car year');
    }
  }
});

test('empty slot previews the weakest slice and one press pins it', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  const weak = chart.locator('.chart-selection-weak');
  await expect(weak).toBeVisible();
  // the preview carries the weak point's own numbers, not just instructions
  await expect(weak.locator('.selection-values')).toContainText('Earned exposure');
  // and it names the same slice the weakness sentence talks about
  const weakness = await chart.locator('.chart-weakness').innerText();
  const button = weak.locator('.pin-weakest');
  const label = (await button.innerText()).replace('Pin weakest slice · ', '').trim();
  expect(weakness).toContain(label.replace(/^age /, ''));

  await button.click();
  await expect(chart.locator('.chart-selection')).toBeVisible();
  await expect(chart.locator('.selection-label')).toContainText(label);
  await expect(page).toHaveURL(/sel=/);
  await expect(page.locator('.exact-values tr.is-selected')).toHaveCount(1);

  // clearing returns the preview, so the affordance never disappears
  await chart.locator('.chart-actions button', { hasText: 'Clear' }).click();
  await expect(weak).toBeVisible();
});

test('the full view carries the weak point and answers a pin on the spot', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  await chart.locator('.expand').click();
  const full = page.locator('.chart-full');
  await expect(full).toBeVisible();
  await expect(full.locator('.chart-weakness')).toContainText('Thinnest evidence');
  await expect(full.locator('.chart-selection-weak')).toBeVisible();

  // pinning inside the full view reads back inside the full view
  await full.locator('svg').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(full.locator('.chart-selection')).toBeVisible();
  await expect(full.locator('.selection-values')).toContainText('Earned exposure');

  await page.keyboard.press('Escape');
  await expect(full).toBeHidden();
  // the card behind shows the same selection: one state, two views
  await expect(chart.locator('.chart-selection')).toBeVisible();
});

test('keyboard pin and ordered range drive chart, table, and URL together', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  const svg = chart.locator('svg').first();
  await svg.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(chart.locator('.chart-selection')).toBeVisible();
  await expect(chart.locator('.selection-values')).toContainText('Earned exposure');
  await expect(page.locator('.exact-values')).not.toHaveAttribute('open', '');
  await expect(page.locator('.exact-values tr.is-selected')).toHaveCount(1);
  await expect(page).toHaveURL(/sel=/);

  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(chart.locator('.selection-label')).toContainText('–');
  expect(await page.locator('.exact-values tr.is-selected').count()).toBeGreaterThan(1);

  await page.keyboard.press('Escape');
  await expect(chart.locator('.chart-selection')).toBeHidden();
  await expect(page).not.toHaveURL(/sel=/);

  const box = await svg.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.42, box!.y + box!.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await expect(chart.locator('.selection-label')).toContainText('–');
  await expect(page.locator('.chart-scrim')).toBeHidden();
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  await expect(svg).toHaveCSS('user-select', 'none');
});

test('tooltip keeps labels and values in separate readable columns', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?theme=light&noanim=1&exp=EXP-07&chart=age_curve');
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({ timeout: 90_000 });
  const svg = page.locator('.selected-evidence .chart-workspace svg').first();
  await svg.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = await svg.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height * 0.5);
  await expect(svg.locator('.tiprow').first()).toBeVisible();
  await expect(svg.locator('.tiprow', { hasText: 'Earned exposure' })).toHaveCount(1);

  const gaps = await svg.locator('.tiprow').evaluateAll((rows) =>
    rows.map((row) => {
      const label = row.querySelector('.tiplabel')!.getBoundingClientRect();
      const value = row.querySelector('.tipvalue')!.getBoundingClientRect();
      return value.left - label.right;
    }),
  );
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8);
});

test('y-axis titles keep a clear gutter from tick labels on wide screens', async ({ page }) => {
  const chartsByExperiment: Record<string, number> = {
    'EXP-01': 3,
    'EXP-02': 3,
    'EXP-03': 3,
    'EXP-04': 3,
    'EXP-05': 3,
    'EXP-06': 2,
    'EXP-07': 4,
  };

  const assertAxisGap = async () => {
    const gap = await page.locator('.selected-evidence .chart-workspace').evaluate((chart) => {
      const title = chart.querySelector('.y-axis-title')!.getBoundingClientRect();
      const ticks = [...chart.querySelectorAll('.y-axis-tick')].map((tick) =>
        tick.getBoundingClientRect(),
      );
      return Math.min(...ticks.map((tick) => tick.left)) - title.right;
    });
    expect(gap).toBeGreaterThanOrEqual(8);
  };

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?theme=light&noanim=1');
  await ready(page);
  for (const [code, count] of Object.entries(chartsByExperiment)) {
    await page.locator('.ledger-row', { hasText: code }).click();
    await expect(page.locator('.selected-evidence .evidence-head')).toContainText(code);
    const tabs = page.locator('.selected-evidence .evidence-tabs button');
    await expect(tabs).toHaveCount(count);
    for (let index = 0; index < count; index++) {
      await tabs.nth(index).click();
      await assertAxisGap();
    }
  }

  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto('/?theme=light&noanim=1&exp=EXP-07&chart=age_curve');
  await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({ timeout: 90_000 });
  await assertAxisGap();
});

test('expanded method notes stay in document flow above evidence provenance', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1&exp=EXP-07&chart=age_curve');
  const focused = page.locator('.selected-evidence .focused-chart');
  await expect(focused).toBeVisible({ timeout: 90_000 });
  await focused.locator('.chart-notes summary').click();
  await expect(focused.locator('.chart-notes')).toHaveAttribute('open', '');
  await expect(focused).toHaveCSS('overflow-y', 'visible');

  const focusBox = await focused.boundingBox();
  const notesBox = await focused.locator('.chart-notes').boundingBox();
  const sourceBox = await page.locator('.selected-evidence .evidence-source').boundingBox();
  expect(notesBox!.y + notesBox!.height).toBeLessThanOrEqual(focusBox!.y + focusBox!.height + 1);
  expect(sourceBox!.y).toBeGreaterThanOrEqual(focusBox!.y + focusBox!.height - 1);
});

test('wide workspace gives evidence the stage and stacks experiment memory', async ({ page }) => {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 2560, height: 1440 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/?theme=light&noanim=1&exp=EXP-07&chart=age_curve');
    await expect(page.locator('.selected-evidence .chart-workspace')).toBeVisible({ timeout: 90_000 });

    const workspace = await page.locator('.run-workspace').boundingBox();
    const evidence = await page.locator('.selected-evidence').boundingBox();
    const ledger = await page.locator('.experiment-ledger').boundingBox();
    const frontier = await page.locator('.frontier-panel').boundingBox();
    const focused = page.locator('.focused-chart');
    const diagnostics = await page.locator('.chart-diagnostics').boundingBox();
    const plot = await page.locator('.focused-chart .chart > svg').boundingBox();

    expect(workspace!.width).toBeGreaterThanOrEqual(Math.min(viewport.width - 50, 2180));
    expect(evidence!.x).toBeLessThan(ledger!.x);
    expect(evidence!.width).toBeGreaterThan(ledger!.width * 1.6);
    expect(Math.round(frontier!.x)).toBe(Math.round(ledger!.x));
    expect(frontier!.y).toBeGreaterThanOrEqual(ledger!.y + ledger!.height - 1);
    expect(plot!.x + plot!.width).toBeLessThanOrEqual(diagnostics!.x + 1);
    await expect(focused).toHaveCSS('overflow-y', 'visible');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});

test('human handoff stays above evidence and desktop guardrails form a checklist', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const promote = page.locator('.goal-bar > .promote');
  await expect(promote).toBeVisible();
  await expect(promote).toContainText('ready for human review');
  await expect(page.locator('.run-view > .promote')).toHaveCount(0);

  const promoteBox = await promote.boundingBox();
  const workspaceBox = await page.locator('.run-workspace').boundingBox();
  expect(promoteBox!.y + promoteBox!.height).toBeLessThan(workspaceBox!.y);

  const rails = await page.locator('.goal-rails > span').evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }),
  );
  expect(rails).toHaveLength(3);
  expect(rails[1].y).toBeGreaterThanOrEqual(rails[0].y + rails[0].height);
  expect(rails[2].y).toBeGreaterThanOrEqual(rails[1].y + rails[1].height);
  expect(Math.abs(rails[0].x - rails[1].x)).toBeLessThanOrEqual(1);
  expect(Math.abs(rails[1].x - rails[2].x)).toBeLessThanOrEqual(1);
});

test('comparison is semantic and guardrails appear only where valid', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const age = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  await age.locator('.chart-mode button', { hasText: 'Change' }).click();
  await expect(age).toHaveAttribute('data-mode', 'change');
  await expect(age.locator('.chart-y-readout')).toContainText('% vs v12');
  await expect(age.locator('.guardrail-line')).toHaveCount(0);
  await expect(page).toHaveURL(/mode=change/);

  await page.locator('.ledger-row', { hasText: 'EXP-03' }).click();
  await expect(page.locator('.selected-evidence .evidence-head')).toContainText('EXP-03');
  const territory = page.locator('.selected-evidence .chart-workspace[data-kind="territory"]');
  // territory answers "how far from filed", so it OPENS on the change view
  // with the tolerance band and the breach that killed the experiment
  await expect(territory).toHaveAttribute('data-mode', 'change');
  await expect(territory.locator('.guardrail-line')).toHaveCount(2);
  await expect(territory.locator('.chart-weakness')).toContainText('5%');
  await expect(territory.locator('.guardrail-breach').first()).toBeVisible();

  // departing from the default is what the URL records
  await territory.locator('.chart-mode button', { hasText: 'Level' }).click();
  await expect(territory).toHaveAttribute('data-mode', 'level');
  await expect(page).toHaveURL(/mode=level/);
  await territory.locator('.chart-mode button', { hasText: 'Change' }).click();
  await expect(page).not.toHaveURL(/mode=/);
});

test('selection can ask with context, copy a link, and enter human review', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);

  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  const svg = chart.locator('svg').first();
  await svg.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await chart.locator('button', { hasText: 'Copy evidence link' }).click();
  await expect(chart.locator('.chart-action-status')).toContainText('copied');

  await chart.locator('button', { hasText: 'Ask about selection' }).click();
  await expect(page.locator('.ask')).toBeVisible();
  const question = page.locator('.ask-compose textarea');
  await expect(question).toHaveValue(/EXP-07/);
  await expect(question).toHaveValue(/earned car year/i);
  const questionBox = await question.evaluate((field) => ({
    clientHeight: field.clientHeight,
    clientWidth: field.clientWidth,
    scrollWidth: field.scrollWidth,
  }));
  expect(questionBox.clientHeight).toBeGreaterThan(40);
  expect(questionBox.scrollWidth).toBeLessThanOrEqual(questionBox.clientWidth + 1);
  await expect(page.locator('.ask-note')).toContainText('cannot fit, merge, or approve');
  await page.locator('.ask-esc').click();

  await chart.locator('button', { hasText: 'Save to review' }).click();
  await expect(chart.locator('.chart-action-status')).toContainText('Saved');
  await page.locator('.promote button').click();
  await expect(page.locator('.saved-evidence')).toBeVisible();
  await expect(page.locator('.saved-evidence')).toContainText('Driver age relativity');
  await expect(page.locator('.saved-evidence')).toContainText('Local prototype evidence');
});

test('stateful evidence URL restores experiment, chart, mode, and selection', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1&exp=EXP-07&chart=age_curve&mode=change&sel=18:22');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.ledger-row[aria-pressed="true"]')).toContainText('EXP-07');
  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  await expect(chart).toHaveAttribute('data-mode', 'change');
  await expect(chart.locator('.selection-label')).toContainText('18–22');
  await expect(page.locator('.exact-values tr.is-selected')).toHaveCount(5);
});

test('invalid URL state cannot create an impossible chart view', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1&exp=EXP-06&chart=missingness&mode=change&sel=-999:999');
  await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="missingness"]');
  await expect(chart).toHaveAttribute('data-mode', 'level');
  await expect(chart.locator('.chart-mode')).toHaveCount(0);
  await expect(chart.locator('.chart-selection')).toBeHidden();
});

test('pinning and comparison keep the working layout geometrically stable', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?theme=light&noanim=1');
  await ready(page);
  const panel = page.locator('.selected-evidence .evidence-focus');
  const promote = page.locator('.promote');
  const beforePanel = await panel.boundingBox();
  const beforePromote = await promote.boundingBox();

  const chart = page.locator('.selected-evidence .chart-workspace[data-kind="age_curve"]');
  await chart.locator('svg').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await chart.locator('.chart-mode button', { hasText: 'Change' }).click();

  const afterPanel = await panel.boundingBox();
  const afterPromote = await promote.boundingBox();
  expect(Math.round(afterPanel!.height)).toBe(Math.round(beforePanel!.height));
  expect(Math.round(afterPromote!.y)).toBe(Math.round(beforePromote!.y));
});

test('missing mileage evidence never overlays unlike units', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);
  await page.locator('.ledger-row', { hasText: 'EXP-06' }).click();
  await expect(page.locator('.selected-evidence .evidence-head')).toContainText('EXP-06');

  const tabs = page.locator('.selected-evidence .evidence-tabs button');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toContainText('Missingness');
  await expect(tabs.nth(1)).toContainText('Frequency');
  await expect(page.locator('.selected-evidence .chart-source')).not.toContainText('Percent missing, and claims');
});

test('failed refresh keeps the last artifact visible and offers retry', async ({ page }) => {
  await page.goto('/?theme=light&noanim=1');
  await ready(page);
  const before = await page.locator('.evidence-focus').boundingBox();

  await page.route('**/graphql', async (route) => {
    const body = route.request().postData() ?? '';
    if (body.includes('evidence(runId') && body.includes('EXP-03')) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.locator('.ledger-row', { hasText: 'EXP-03' }).click();
  await expect(page.locator('.evidence-stale')).toContainText('showing EXP-07');
  await expect(page.locator('.evidence-head')).toContainText('EXP-07');
  const stale = await page.locator('.evidence-focus').boundingBox();
  expect(Math.round(stale!.height)).toBe(Math.round(before!.height));

  await page.unroute('**/graphql');
  await page.locator('.evidence-stale').click();
  await expect(page.locator('.evidence-head')).toContainText('EXP-03', { timeout: 20_000 });
  await expect(page.locator('.evidence-stale')).toBeHidden();
});

test('initial entrance uses layered blur without moving reserved geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?theme=light');
  await expect(page.locator('.topbar')).toBeAttached();

  const shell = page.locator('.topbar');
  const before = await shell.evaluate((node) => {
    const element = node as HTMLElement;
    return {
      left: element.offsetLeft,
      top: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
      visualY: element.getBoundingClientRect().y,
    };
  });
  const contract = await shell.evaluate((node) => {
    const animation = node.getAnimations().find((item) =>
      (item as CSSAnimation).animationName === 'entrance-resolve'
    ) as CSSAnimation | undefined;
    const effect = animation?.effect as KeyframeEffect | null;
    return {
      name: animation?.animationName,
      duration: effect?.getTiming().duration,
      delay: effect?.getTiming().delay,
      first: effect?.getKeyframes()[0],
    };
  });
  expect(contract.name).toBe('entrance-resolve');
  expect(contract.duration).toBe(480);
  expect(contract.delay).toBe(0);
  expect(Number(contract.first?.opacity)).toBe(0);
  expect(String(contract.first?.filter)).toContain('blur(5px)');
  expect(String(contract.first?.transform)).toContain('6px');

  await page.waitForTimeout(950);
  const after = await shell.evaluate((node) => {
    const element = node as HTMLElement;
    return {
      left: element.offsetLeft,
      top: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
      visualY: element.getBoundingClientRect().y,
    };
  });
  expect({ ...after, visualY: 0 }).toEqual({ ...before, visualY: 0 });
  expect(Math.abs(after.visualY - before.visualY)).toBeLessThanOrEqual(6);
});

test('noanim and reduced motion render entrance layers settled immediately', async ({ page }) => {
  const selectors = '.topbar, .context-strip, .goal-bar, .experiment-ledger, .frontier-panel';
  await page.goto('/?theme=light&noanim=1');
  await expect(page.locator('.experiment-ledger')).toBeVisible();
  for (const layer of await page.locator(selectors).all()) {
    await expect(layer).toHaveCSS('opacity', '1');
    await expect(layer).toHaveCSS('filter', 'none');
    expect(await layer.evaluate((node) =>
      node.getAnimations().some((animation) =>
        (animation as CSSAnimation).animationName === 'entrance-resolve'
      ),
    )).toBe(false);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?theme=light');
  await expect(page.locator('.experiment-ledger')).toBeVisible();
  for (const layer of await page.locator(selectors).all()) {
    await expect(layer).toHaveCSS('opacity', '1');
    await expect(layer).toHaveCSS('filter', 'none');
  }
});
