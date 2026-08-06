# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: screens.spec.ts >> console final, dark, plain terms on
- Location: e2e\screens.spec.ts:39:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.promote')
Expected: visible
Timeout: 90000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 90000ms
  - waiting for locator('.promote')

```

```yaml
- banner:
  - text: Working build
  - heading "Experiments" [level=1]
  - paragraph: "A working slice of the agent era of Prediction Lab: you state the goal and the guardrails, the modeling agent runs the grind against a real backend, and every experiment ends in a written verdict. Scrapped paths stay on the board with their reasons, so no dead end gets walked twice. One winner earns its way to review."
  - text: Ryan Allen ·
  - link "fullbuild.ai":
    - /url: https://fullbuild.ai
  - text: · synthetic data, real fits
- alert: "Error: error occurred while decoding column 6: mismatched types; Rust type `f64` (as SQL type `FLOAT8`) is not compatible with SQL type `NUMERIC`"
- region "Prediction Lab window":
  - text: Prediction Lab›Models›Bodily Injury Frequency›Experiments
  - heading "Experiment run" [level=2]
  - text: Loading the run runs on its own branch Frequency is how often a driver’s actions lead to bodily injury claims against the policy, and this model predicts that rate per insured car year. Every input it prices on is a rating factor. Territory relativities are the zone by zone price multipliers, filed with the regulator, which is why they may not drift. 0 of 7 experiments 0 candidates 0 scrapped elapsed 0.0s
  - button "Replay run"
  - text: ΔGini is separation power, how much better the model splits high risk drivers from low risk, higher is better. Deviance is the model’s error score, and the chip shows how much it changed, so a minus number means the error shrank. The five dots re run each experiment on five random slices of the data, green means the gain held on that slice.
  - complementary:
    - heading "Frontier" [level=3]
    - img "Gini against added factors. Each experiment lands as a dot when it fits. The winner sits highest.": 0.20 0 1 2 3 Gini factor budget used
    - text: Lift against factor budget used. Dots land as fits finish. Blue holds the current frontier. Each dot is one experiment, accuracy gained against factor slots spent. The blue path is the best trade that passed the guardrails at each spend, and the ringed dot is the winner.
    - heading "Guardrails" [level=3]
    - text: Hard limits the platform checks outside the agent, so they are enforced, not promised. None tripped during this run.
    - heading "Baseline" [level=3]
    - text: Model BI Frequency v12 Gini … Factors … Mean fit time …
    - heading "Display" [level=3]
    - text: Plain terms one plain English line under every result
    - switch "Plain terms" [checked]
    - heading "Theme" [level=3]
    - group "Theme":
      - button "Light"
      - button "Dark" [pressed]
      - button "System"
    - text: Every verdict is written to the run ledger with its reason, so scrapped paths stay on record. Nothing ships until a person signs the review.
```

# Test source

```ts
  1  | // Headless verification: drive a real run against the real backend and
  2  | // capture both views in both themes. Screenshots land in ../.tmp/shots.
  3  | 
  4  | import { expect, test, type Page } from '@playwright/test';
  5  | import * as fs from 'node:fs';
  6  | 
  7  | const OUT = '../.tmp/shots';
  8  | fs.mkdirSync(OUT, { recursive: true });
  9  | 
  10 | async function freeze(page: Page) {
  11 |   await page.evaluate(() => (window as any).__capture.freeze());
  12 | }
  13 | 
  14 | async function waitForComplete(page: Page) {
> 15 |   await expect(page.locator('.promote')).toBeVisible({ timeout: 90_000 });
     |                                          ^ Error: expect(locator).toBeVisible() failed
  16 | }
  17 | 
  18 | test('console mid-run and final, light', async ({ page }) => {
  19 |   await page.goto('/?theme=light');
  20 |   // fresh run so the mid-run state is real
  21 |   const replay = page.locator('.replay');
  22 |   await replay.waitFor();
  23 |   if (await replay.isEnabled()) {
  24 |     await replay.click();
  25 |   }
  26 |   await expect(page.locator('.exp').first()).toBeVisible({ timeout: 30_000 });
  27 |   await page.screenshot({ path: `${OUT}/console-midrun-light.png`, fullPage: true });
  28 |   await waitForComplete(page);
  29 |   await freeze(page);
  30 |   await page.screenshot({ path: `${OUT}/console-final-light.png`, fullPage: true });
  31 | 
  32 |   // expert layer sanity: chips carry real numbers, verdicts are written
  33 |   await expect(page.locator('.exp .verdict')).toHaveCount(7);
  34 |   const text = await page.locator('.main').innerText();
  35 |   expect(text).toContain('ΔGini');
  36 |   expect(text).not.toContain('—'); // no em dashes anywhere
  37 | });
  38 | 
  39 | test('console final, dark, plain terms on', async ({ page }) => {
  40 |   await page.goto('/?theme=dark&plain=1');
  41 |   await waitForComplete(page);
  42 |   await freeze(page);
  43 |   await expect(page.locator('.gloss.block')).toBeVisible();
  44 |   await page.screenshot({ path: `${OUT}/console-final-dark-plain.png`, fullPage: true });
  45 | });
  46 | 
  47 | test('review open and approve, light', async ({ page }) => {
  48 |   await page.goto('/?theme=light#review');
  49 |   await expect(page.locator('.rv-head')).toBeVisible({ timeout: 90_000 });
  50 |   await expect(page.locator('.led-row')).toHaveCount(7);
  51 |   await freeze(page);
  52 |   await page.screenshot({ path: `${OUT}/review-open-light.png`, fullPage: true });
  53 | 
  54 |   const approve = page.locator('.rv-approve button');
  55 |   if (await approve.isVisible()) {
  56 |     await approve.click();
  57 |     await expect(page.locator('.rv-approve .stamp')).toBeVisible({ timeout: 15_000 });
  58 |     await expect(page.locator('.status.approved')).toBeVisible();
  59 |   }
  60 |   await page.screenshot({ path: `${OUT}/review-approved-light.png`, fullPage: true });
  61 | });
  62 | 
  63 | test('review, dark', async ({ page }) => {
  64 |   await page.goto('/?theme=dark#review');
  65 |   await expect(page.locator('.rv-head')).toBeVisible({ timeout: 90_000 });
  66 |   await freeze(page);
  67 |   await page.screenshot({ path: `${OUT}/review-dark.png`, fullPage: true });
  68 | });
  69 | 
```