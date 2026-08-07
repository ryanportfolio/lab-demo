# Actuarial Poster Cross-Links Implementation Plan

> **For agentic workers:** Implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the supplied actuarial UX/chart loop as a second Railway-served standalone page, enlarge its text, and connect both poster pages with reciprocal CTAs.

**Architecture:** Preserve both visualizations as self-contained Vite public assets. Add one outer-document link above each sandboxed `srcdoc` iframe so navigation changes the top-level route. Extend the existing Playwright suite to verify both pages, CTAs, typography, and overflow at desktop and compact heights.

**Tech Stack:** Static HTML/CSS/SVG, Vite public assets, Playwright, existing Rust static-file fallback.

---

### Task 1: Add the chart-loop page

**Files:**
- Create: `frontend/public/actuarial-ux-chart-loop.html`

- [ ] **Step 1: Port the supplied page**

Copy `actuarial-ux-chart-loop-standalone.html` into Vite public assets and expose it at `/actuarial-ux-chart-loop.html`.

- [ ] **Step 2: Increase chart-loop typography**

Use a 16px base and `clamp(14px, 1.55vh, 17px)` poster copy. Keep compact-height copy at 14px, shorten the compact schematic/output rhythm, and hide only `.ucl-extra` content below 780px height so text does not collide.

- [ ] **Step 3: Make the outer document fullscreen**

Remove the generated one-rem preview gutter and set the iframe to `100vh`, matching the research-system route.

### Task 2: Add reciprocal CTA navigation

**Files:**
- Modify: `frontend/public/actuarial-research-system.html`
- Modify: `frontend/public/actuarial-ux-chart-loop.html`

- [ ] **Step 1: Add the shared CTA treatment**

Add a keyboard-focusable `.page-switch` pill centered in the unused top-header space with a high-contrast translucent surface and visible focus ring.

- [ ] **Step 2: Link research to chart loop**

Use `<a class="page-switch" href="/actuarial-ux-chart-loop.html">Chart workspace loop →</a>`.

- [ ] **Step 3: Link chart loop to research**

Use `<a class="page-switch" href="/actuarial-research-system.html">Research system →</a>`.

### Task 3: Extend regression coverage

**Files:**
- Modify: `frontend/e2e/research-system.spec.ts`

- [ ] **Step 1: Verify both routes and CTAs**

Assert each document title, embedded poster sentinel, CTA target, and reciprocal click navigation.

- [ ] **Step 2: Verify larger chart-loop type**

At 1920×1080 assert chart-loop body ≥16px and labels ≥14px. At 1280×720 assert body and labels ≥14px.

- [ ] **Step 3: Verify containment**

At both viewports assert each stage output stays within its stage and the iframe document has no vertical overflow.

### Task 4: Verify and integrate

**Files:**
- Verify: `frontend/dist/actuarial-research-system.html`
- Verify: `frontend/dist/actuarial-ux-chart-loop.html`

- [ ] **Step 1: Run `npm run build` and `npm run typecheck`**

Expected: Vite build and TypeScript complete successfully; both standalone files appear in `dist/`.

- [ ] **Step 2: Run focused Playwright tests**

Expected: all poster route, CTA, typography, connector, and overflow checks pass against a fresh preview port.

- [ ] **Step 3: Capture desktop and compact visuals**

Expected: larger copy remains legible and collision-free; CTAs occupy unused header space and do not cover poster content.

- [ ] **Step 4: Auto-merge**

Stage only poster/test/plan files, commit with co-author trailer, push the session branch, create or reuse one PR, squash-merge into `main`, re-sync the branch, and confirm Railway serves both final URLs.
