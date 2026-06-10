#!/usr/bin/env node
/**
 * visual-test.js — Orchestrates the css2tw visual regression test.
 *
 * Usage:
 *   node scripts/visual-test.js -- <original.html> <converted.tw.html>
 *
 * The two HTML paths are resolved relative to the monorepo root (two levels up
 * from this package directory).
 */

const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2).filter(a => a !== '--');
if (args.length < 2) {
  console.error('Usage: node scripts/visual-test.js -- <original.html> <converted.tw.html>');
  process.exit(1);
}

const [fileA, fileB] = args;

// Resolve absolute paths relative to monorepo root
const root = path.resolve(__dirname, '../../..');
const absA = path.resolve(root, fileA);
const absB = path.resolve(root, fileB);

console.log(`Running visual test for:\n  A: ${fileA}\n  B: ${fileB}`);

// Pass paths as env vars so Playwright spec can pick them up
const env = {
  ...process.env,
  FILE_A: absA,
  FILE_B: absB,
};

try {
  execSync(
    `npx playwright test tests/before-after.spec.ts --reporter=list`,
    {
      cwd: path.resolve(__dirname, '..'),
      env,
      stdio: 'inherit',
    }
  );
  console.log('\n[CSS2TW REPORT COMPLETE]');
} catch {
  console.log('\n[CSS2TW REPORT COMPLETE]');
  process.exit(1);
}
