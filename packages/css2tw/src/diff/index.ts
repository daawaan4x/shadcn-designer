import { PhaseInput, PhaseOutput, DiffEngineInput } from './shared';
import { phase0Stabilize } from './phase-0-stabilize';
import { phase1Layout } from './phase-1-layout';
import { phase2ComputedStyle } from './phase-2-computed-style';
import { phase3UxAudit } from './phase-3-ux-audit';
import { phase4Pixelmatch } from './phase-4-pixelmatch';
import { YamlFileLogger } from './logger';
import path from 'path';
import fs from 'fs';

export async function runDiffEngine({ page1, page2 }: DiffEngineInput): Promise<PhaseOutput> {
  let layoutErrors = 0;
  let cssErrors = 0;
  let uxErrors = 0;
  let visualPageErrors = 0;
  let visualComponentErrors = 0;

  const tmpDir = path.resolve(__dirname, '../../tests/tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const diagPath = path.resolve(tmpDir, `diagnostics_${timestamp}.yaml`);
  const logger = new YamlFileLogger(diagPath);

  // Infer base name from URL
  const urlPath = new URL(page1.url()).pathname;
  let baseName = urlPath.split('/').pop()?.replace('.html', '') || 'unknown';

  logger.log(`Starting Diff Engine for ${baseName}`);

  // Inject script to ensure fonts and animations are settled if any
  await Promise.all([
    page1.evaluate(() => document.fonts.ready),
    page2.evaluate(() => document.fonts.ready)
  ]);

  // Extract CSS source sheet mapping
  const cdp1 = await page1.context().newCDPSession(page1);
  const cdp2 = await page2.context().newCDPSession(page2);
  await cdp1.send('DOM.enable'); await cdp1.send('CSS.enable');
  await cdp2.send('DOM.enable'); await cdp2.send('CSS.enable');

  // Dynamic Breakpoint Extraction from source HTML
  const breakpoints = await page1.evaluate(() => {
    const bps = new Set<number>();
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSMediaRule) {
            const matches = rule.media.mediaText.match(/(min|max)-width:\s*(\d+)px/g);
            if (matches) {
              matches.forEach((m: string) => {
                const match = m.match(/\d+/);
                if (match) bps.add(parseInt(match[0], 10));
              });
            }
          }
        }
      } catch (e) {} // Handle CORS or cross-origin errors if any
    }
    return Array.from(bps).sort((a, b) => b - a); // Descending
  });

  // Construct viewports to test
  const viewports = [{ width: 1280, height: 800 }]; // Default Desktop
  for (const bp of breakpoints) {
    // If it's max-width, test exactly AT the breakpoint, and slightly below it
    viewports.push({ width: bp, height: 800 });
  }

  for (const viewport of viewports) {
    const vpLog = logger.fork(`Viewport ${viewport.width}x${viewport.height}`);
    
    // Proactive Breakpoint "Cheat Sheet"
    const mediaRules = await page1.evaluate((vw) => {
      const activeRules: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSMediaRule) {
              if (window.matchMedia(rule.media.mediaText).matches) {
                // If it's specifically a max-width matching the viewport, extract it
                if (rule.media.mediaText.includes(`${vw}px`)) {
                  for (const r of Array.from(rule.cssRules)) {
                    activeRules.push(r.cssText);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }
      return activeRules;
    }, viewport.width);

    if (mediaRules.length > 0) {
      const cheatSheetLog = vpLog.fork('Source CSS Cheat Sheet (Media Query Delta)');
      mediaRules.forEach(r => cheatSheetLog.log(r));
    }

    await page1.setViewportSize(viewport);
    await page2.setViewportSize(viewport);

    const input: PhaseInput = {
      page1,
      page2,
      baseName,
      logger: vpLog,
      cdp1,
      cdp2,
      viewport
    };

    // Phase 0: Environment Stabilization
    await phase0Stabilize(input);

    // Phase 1: Layout Shifts
    const layoutResult = await phase1Layout(input);
    layoutErrors += layoutResult.layoutErrors || 0;

    // Phase 2: Computed Styles
    const styleResult = await phase2ComputedStyle(input);
    cssErrors += styleResult.cssErrors || 0;

    // Phase 3: UX & Interactive State Auditing
    const uxResult = await phase3UxAudit({ 
      ...input, 
      allUxDiffs: styleResult.allUxDiffs,
      uxMismatchCount: styleResult.uxMismatchCount
    });
    uxErrors += uxResult.uxErrors || 0;

    // Phase 4: Pixelmatch (Static Screenshots)
    const pixelResult = await phase4Pixelmatch(input);
    visualPageErrors += pixelResult.visualPageErrors || 0;
    visualComponentErrors += pixelResult.visualComponentErrors || 0;
  }

  logger.close();
  return { layoutErrors, cssErrors, uxErrors, visualPageErrors, visualComponentErrors };
}
