import { test, expect } from '@playwright/test';
import { runDiffEngine } from '../src/diff';
import path from 'path';

// Read explicit HTML files from environment variables set by the wrapper script
const fileA = process.env.FILE_A;
const fileB = process.env.FILE_B;

if (!fileA || !fileB) {
  console.error("Error: You must provide exactly two HTML files to compare.");
  process.exit(1);
}

const baseNameA = path.basename(fileA);
const baseNameB = path.basename(fileB);

test.describe(`Visual Regression: ${baseNameA} vs ${baseNameB}`, () => {
  test(`compares ${fileA} vs ${fileB} live (Responsive)`, async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Navigate using absolute paths if needed, or file:// protocol
    const urlA = 'file://' + fileA;
    const urlB = 'file://' + fileB;

    await page1.goto(urlA);
    await page1.waitForLoadState('networkidle');
    
    await page2.goto(urlB);
    await page2.waitForLoadState('networkidle');

    const result = await runDiffEngine({
      page1,
      page2
    });

    expect.soft(result.visualPageErrors, `[RESPONSIVE AUDIT] Visual regressions detected across viewports! Check tests/tmp/diagnostics_*.yaml`).toBe(0);
    expect.soft(result.visualComponentErrors, `[RESPONSIVE AUDIT] Component visual regressions detected!`).toBe(0);
    expect.soft(result.uxErrors, `[RESPONSIVE AUDIT] UX interactivity regressions detected!`).toBe(0);
  });
});
