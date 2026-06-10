# CSS to Tailwind Tooling (`css2tw`)

This workspace is meant to be an umbrella package for all tooling related to migrating single HTML files (common format of prototype designs) from pure CSS to Tailwind CSS.

Currently, it contains visual regression tests and auto-scaffolding scripts for migrating pure CSS/HTML to Tailwind CSS.

## Visual Regression Testing

The testing pipeline ensures a pixel-perfect conversion by comparing `file.html` against `file.tw.html`.

**Command:**
```bash
pnpm --filter @workspace/css2tw run test:visual -- design/file.html design/tmp/file.tw.html
```

### Features

- **Component-Level Isolation:** Add `data-testid="my-component"` to your HTML to test specific component boundaries. The test suite automatically crops and diffs these areas first, reporting localized layout failures before a full-page failure.
- **Computed Style Diffing:** When visual mismatches occur, the reporter extracts the `window.getComputedStyle()` properties of failing DOM nodes and highlights exactly which CSS properties differ between the original and Tailwind versions.
- **Artifact Surfacing:** Mismatches generate candidate DOM node hints (deepest intersecting elements) and output the mismatching bounding box coordinates, allowing for faster localized debugging.
- **Transition Freezing:** All CSS transitions and animations are globally frozen during test execution to prevent race conditions and screenshot capture errors mid-transition.
- **Dynamic Responsive Verification:** Instead of hardcoded breakpoints, the test dynamically parses the source CSS for `@media (max-width)` rules and iterates over those exact viewports. This strictly enforces responsive parity without mandating responsiveness on desktop-only files.

## Workflows

### 1. Manual Development
1. Run the init script: `pnpm --filter @workspace/css2tw run init:tw design/file.html`
2. Create a `design/tmp/` folder with a `*` `.gitignore` (so backups aren't tracked): `mkdir -p design/tmp && echo "*" > design/tmp/.gitignore`
3. **Back up the original file** before touching it: `cp design/file.tw.html design/tmp/file_YYYY-MM-DD_hh-mm-ss.backup.tw.html`
4. Copy the generated `<script>tailwind.config=...</script>` block into `design/file.tw.html`.
5. Manually convert the CSS rules in the HTML into Tailwind utility classes directly in `design/file.tw.html`.
6. Run `pnpm --filter @workspace/css2tw run test:visual -- design/file.html design/file.tw.html` to visually compare your changes.
7. If the test fails, inspect the console output and `test-results/diagnostics.txt` to find exact computed style mismatches. Iterate until the test passes.

### 2. Using AI Chat (Web Interface)
If you are using an AI like Claude or ChatGPT in a separate browser window and pasting files back and forth:
1. Provide the AI with your `design/file.html`.
2. Ask the AI to run its "HTML to Tailwind" conversion and output the resulting `file.tw.html` (including the `tailwind.config` block).
3. Save the AI's output to `design/tmp/file.tw.html` locally.
4. Run `pnpm --filter @workspace/css2tw run test:visual -- design/file.html design/tmp/file.tw.html` locally.
5. If the test fails, copy the contents of `packages/css2tw/tests/tmp/diagnostics*.yaml` and paste it back into the chat. Tell the AI: *"The visual regression test failed with these mismatches. Please fix the Tailwind classes."*
6. Repeat until the AI produces a 100% pixel-perfect match.

### 3. Agentic Development (CLI Agents)
If the AI has direct access to your terminal and file system (e.g., Claude Code, local agents):
1. Instruct the agent: *"Convert design/file.html to Tailwind using the css2tw workspace."*
2. The agent MUST create a `design/tmp/` folder with a `*` `.gitignore`, then **back up the target file** before modifying it: `cp design/file.tw.html design/tmp/file_YYYY-MM-DD_hh-mm-ss.backup.tw.html`
3. The agent works **directly on `design/file.tw.html`** — no copy or export step needed.
4. The agent should run `pnpm --filter @workspace/css2tw run test:visual -- design/file.html design/file.tw.html` itself to verify its work.
5. The agent can read `packages/css2tw/tests/tmp/diagnostics*.yaml` directly to self-correct any visual or UX mismatches without needing your intervention.

> [!IMPORTANT]
> **AI Agent Instructions:** The visual tests run as asynchronous background tasks. The system will **automatically wake** the agent when the test completes and the console output is ready. 
> 
> **Do NOT use the `schedule` tool** or attempt to poll the test status. Rely entirely on the reactive wakeup.

## Auto-Scaffolding

If your original `design/file.html` contains CSS custom properties (variables) in a `<style>` block, you can automatically generate a base Tailwind configuration.

**Command:**
```bash
pnpm --filter @workspace/css2tw run init:tw design/file.html
```

This will parse all `--var-name: value` lines and print a `<script> tailwind.config = ... </script>` block with the mapped theme tokens, ready to be injected into your `.tw.html` file.

## How it works (The Testing Pipeline)

The `css2tw` testing framework runs an exhaustive, multi-phase verification pipeline in Playwright to guarantee that the Tailwind HTML matches the original CSS perfectly, both statically and interactively. The engine is modularized under `packages/css2tw/src/diff/` to keep test orchestration cleanly separated from the diff logic.

### Phase 0: Dynamic Breakpoint Extraction
Before testing, the pipeline parses `document.styleSheets` of the source HTML to find all `CSSMediaRule` definitions (`min-width`/`max-width`). It then iterates the test suite across those exact viewports (plus desktop), ensuring strict responsive parity.

### Phase 1: Environment Stabilization
Before taking any measurements, the test injects a global stylesheet (`transition: none !important; animation: none !important`) into both pages. This freezes all animations and transitions, preventing race conditions or misaligned screenshots caused by mid-animation state captures.

### Phase 2: Relative Layout Shift Detection
Instead of just failing a screenshot, the test performs a mathematical DOM audit. It iterates through every element and calculates its `BoundingClientRect` relative to its parent. This isolates "Root Cause" layout shifts. For example, if a header container shifts down by 50px, all 100 child elements also shift down by 50px. Instead of reporting 100 errors, the pipeline intelligently reports only the header container as the root cause.

### Phase 3: Computed Style Diffing
The test extracts the `window.getComputedStyle()` for every DOM node in both documents. It filters out absolute layout coordinates (which are covered by Phase 2) and heavily normalizes the remaining CSS (e.g., converting all `rgb()` colors to `oklch()`, stripping invisible borders, and normalizing `rgba(0,0,0,0)` transparent box shadows). It then runs a strict equality check, flagging exact CSS property differences (like `line-height`, `font-size`, `padding`) between the original and Tailwind versions.

### Phase 4: UX & Interactive Audit (CDP)
Pixel-perfect static views do not guarantee a 1:1 user experience. Using the Chrome DevTools Protocol (CDP), the test programmatically forces `:hover` and `:focus` pseudo-states on all interactive elements (`a`, `button`, `input`, etc.) without dispatching real JavaScript `click` or `mouse` events that might trigger application logic. It then diffs the computed styles of these pseudo-states to ensure interactive states (like hover colors or focus rings) match exactly.

### Phase 5: Pixelmatch Failsafe
As a final, absolute guarantee, Playwright captures full-page `Buffer` screenshots of both the original and the Tailwind DOM. It runs these buffers through `pixelmatch` with a strict anti-aliasing threshold. If even a single pixel differs, the test outputs a `diff.png` highlighting the exact visual mismatch and fails the run.
