# CSS to Tailwind Tooling (`css2tw`)

This workspace contains visual regression tests and auto-scaffolding scripts for migrating pure CSS/HTML to Tailwind CSS.

## Visual Regression Testing

The testing pipeline ensures a pixel-perfect conversion by comparing `file.html` against `file.tw.html`.

**Command:**
```bash
pnpm --filter @workspace/css2tw run test:visual
```

### Features

- **Component-Level Isolation:** Add `data-testid="my-component"` to your HTML to test specific component boundaries. The test suite automatically crops and diffs these areas first, reporting localized layout failures before a full-page failure.
- **Computed Style Diffing:** When visual mismatches occur, the reporter extracts the `window.getComputedStyle()` properties of failing DOM nodes and highlights exactly which CSS properties differ between the original and Tailwind versions.
- **Artifact Surfacing:** Mismatches generate candidate DOM node hints (deepest intersecting elements) and output the mismatching bounding box coordinates, allowing for faster localized debugging.
- **Transition Freezing:** All CSS transitions and animations are globally frozen during test execution to prevent race conditions and screenshot capture errors mid-transition.

## Workflows

### 1. Manual Development
1. Run the init script: `pnpm --filter @workspace/css2tw run init:tw design/file.html`
2. Copy the generated `<script>tailwind.config=...</script>` block into `design/file.tw.html`.
3. Manually convert the CSS rules in the HTML into Tailwind utility classes.
4. Run `pnpm --filter @workspace/css2tw run test:visual` to visually compare your changes.
5. If the test fails, inspect the console output and `test-results/diagnostics.txt` to find exact computed style mismatches. Iterate until the test passes.

### 2. Using AI Chat (Web Interface)
If you are using an AI like Claude or ChatGPT in a separate browser window and pasting files back and forth:
1. Provide the AI with your `design/file.html`.
2. Ask the AI to run its "HTML to Tailwind" conversion and output the resulting `file.tw.html` (including the `tailwind.config` block).
3. Save the AI's output to `design/file.tw.html` locally.
4. Run `pnpm --filter @workspace/css2tw run test:visual` locally.
5. If the test fails, copy the contents of `packages/css2tw/tests/tmp/diagnostics.txt` and paste it back into the chat. Tell the AI: *"The visual regression test failed with these mismatches. Please fix the Tailwind classes."*
6. Repeat until the AI produces a 100% pixel-perfect match.

### 3. Agentic Development (CLI Agents)
If the AI has direct access to your terminal and file system (e.g., Claude Code, local agents):
1. Instruct the agent: *"Convert design/file.html to Tailwind using the css2tw workspace."*
2. The agent should write its attempts to `design/file.tw.html`.
3. The agent should run `pnpm --filter @workspace/css2tw run test:visual` itself to verify its work.
4. The agent can read `packages/css2tw/tests/tmp/diagnostics.txt` directly to self-correct any visual or UX mismatches without needing your intervention.

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
