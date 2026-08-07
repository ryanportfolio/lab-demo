# Actuarial Research System Standalone Page Implementation Plan

> **For agentic workers:** Implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the supplied actuarial research system poster as a standalone static route in the Railway-served frontend, with substantially larger small/body copy and a clean review-stage shield connector.

**Architecture:** Keep the poster self-contained as one HTML asset under Vite's `public/` directory. Vite copies the page unchanged into `dist/`, and the existing Rust static handler serves the exact `.html` path in Railway. Add one Playwright test that enters the embedded `srcdoc` frame and verifies route identity, typography floor, connector geometry, and overflow.

**Tech Stack:** Static HTML/CSS/SVG, Vite public assets, Playwright.

---

### Task 1: Add the standalone poster route

**Files:**
- Create: `frontend/public/actuarial-research-system.html`

- [x] **Step 1: Port the supplied self-contained HTML**

Copy the supplied `actuarial-research-system-standalone.html` into Vite public assets so its production URL is `/actuarial-research-system.html`.

- [x] **Step 2: Make the outer document a true full-page canvas**

Set the outer `html`, `body`, and `iframe` to fill the viewport, remove the generated one-rem preview gutter, and keep overflow contained.

- [x] **Step 3: Increase the type floor**

Change the embedded defaults from 14px/12px to a 16px base, `clamp(15px, 1.7vh, 18px)` poster copy, and 14px compact-height copy. This lets lists and explanations use more of each stage's vertical space without changing content hierarchy.

- [x] **Step 4: Stop the review connector at the shield edge**

Change the incoming SVG path from `M181 55 H270` to `M181 55 H241`, matching the shield's left-most x-coordinate and removing the line that intrudes behind the checkmark.

### Task 2: Add route regression coverage

**Files:**
- Create: `frontend/e2e/research-system.spec.ts`

- [x] **Step 1: Verify route and embedded poster identity**

Navigate to `/actuarial-research-system.html`, assert the document title, and assert the iframe's `#ars-poster` is visible.

- [x] **Step 2: Verify readable typography at desktop and compact heights**

At 1920×1080, assert poster copy is at least 17px and the smallest label is at least 14px. At 1280×720, assert poster copy remains at least 14px.

- [x] **Step 3: Verify the schematic and fixed-canvas fit**

Assert the review-stage path ends at `H241`, the obsolete `H270` path is absent, and `#ars-poster` has no vertical overflow at both tested viewports.

### Task 3: Verify build and browser output

**Files:**
- Verify: `frontend/dist/actuarial-research-system.html`

- [x] **Step 1: Build the frontend**

Run `npm run build` in `frontend`. Expected: Vite exits successfully and copies the standalone page into `dist/`.

- [x] **Step 2: Run the focused browser test**

Run `npx playwright test e2e/research-system.spec.ts` against a fresh local Vite server. Expected: all route, type, connector, and overflow assertions pass.

- [x] **Step 3: Inspect matched screenshots**

Capture 1920×1080 and 1280×720. Confirm larger copy materially fills the prior dead space, text remains unclipped, the shield connector terminates at its outline, and the page has no outer preview gutter.

- [x] **Step 4: Review explicit diff only**

Inspect only the plan, standalone page, and focused test. Do not stage, commit, push, or deploy without a separate user request.
