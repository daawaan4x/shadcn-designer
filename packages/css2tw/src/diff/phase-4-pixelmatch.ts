import { PhaseInput, PhaseOutput } from './shared';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

export async function phase4Pixelmatch(input: PhaseInput): Promise<PhaseOutput> {
  const { page1, page2, baseName, viewport, logger } = input;
  let visualPageErrors = 0;
  let visualComponentErrors = 0;

  const originalBuffer = await page1.screenshot({ fullPage: true });
  const twBuffer = await page2.screenshot({ fullPage: true });

  const img1 = PNG.sync.read(originalBuffer);
  const img2 = PNG.sync.read(twBuffer);
  
  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);
  const diff = new PNG({ width, height });

  if (img1.width !== img2.width || img1.height !== img2.height) {
    logger.error(`[DIMENSION MISMATCH] Original: ${img1.width}x${img1.height}, Target: ${img2.width}x${img2.height}`);
    visualPageErrors++;
  }

  // --- Component-Level Isolation ---
  const components = await page1.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-testid]'));
    return els.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        testId: el.getAttribute('data-testid'),
        x: Math.floor(rect.x),
        y: Math.floor(rect.y),
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height)
      };
    }).sort((a, b) => (a.width * a.height) - (b.width * b.height));
  });

  const diffRegion = (x: number, y: number, w: number, h: number) => {
    const data1 = Buffer.alloc(w * h * 4);
    const data2 = Buffer.alloc(w * h * 4);
    const diffData = Buffer.alloc(w * h * 4);
    for (let row = 0; row < h; row++) {
      const srcY = y + row;
      if (srcY >= height) continue;
      const srcIdx1 = (srcY * img1.width + x) * 4;
      const srcIdx2 = (srcY * img2.width + x) * 4;
      const dstIdx = (row * w) * 4;
      const len1 = Math.min(w, img1.width - x) * 4;
      const len2 = Math.min(w, img2.width - x) * 4;
      if (len1 > 0 && srcIdx1 >= 0 && dstIdx >= 0) {
        img1.data.copy(data1, dstIdx, srcIdx1, srcIdx1 + len1);
      }
      if (len2 > 0 && srcIdx2 >= 0 && dstIdx >= 0) {
        img2.data.copy(data2, dstIdx, srcIdx2, srcIdx2 + len2);
      }
    }
    const numDiff = pixelmatch(data1, data2, diffData, w, h, { threshold: 0.1 });
    return numDiff;
  };

  const failingComponents = [];
  for (const comp of components) {
    if (comp.width <= 0 || comp.height <= 0) continue;
    const numDiff = diffRegion(comp.x, comp.y, comp.width, comp.height);
    if (numDiff > 0) {
      failingComponents.push({ ...comp, numDiff });
    }
  }

  if (failingComponents.length > 0) {
    logger.error(`[COMPONENT ISOLATION] Visual mismatch detected in components: ${failingComponents.map(c => c.testId).join(', ')}`);
    visualComponentErrors += failingComponents.length;
  }

  // --- Full Page Diffing ---
  const croppedImg1 = Buffer.alloc(width * height * 4);
  const croppedImg2 = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    img1.data.copy(croppedImg1, y * width * 4, y * img1.width * 4, y * img1.width * 4 + width * 4);
    img2.data.copy(croppedImg2, y * width * 4, y * img2.width * 4, y * img2.width * 4 + width * 4);
  }
  
  const numDiffPixels = pixelmatch(
    croppedImg1,
    croppedImg2,
    diff.data,
    width,
    height,
    { threshold: 0.1 } // Allow minor anti-aliasing differences
  );

  // Block removed to fix duplication

  const vpStr = viewport ? `_${viewport.width}x${viewport.height}` : '';

  if (numDiffPixels > 0) {
    const tmpDir = path.resolve(__dirname, '../../tests/tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const diffPath = path.resolve(tmpDir, `${baseName}${vpStr}-diff.png`);
    const evaluatedHtmlPath = path.resolve(tmpDir, `${baseName}${vpStr}-evaluated.html`);
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    
    const evaluatedHtml = await page2.content();
    fs.writeFileSync(evaluatedHtmlPath, evaluatedHtml);
    const diffLog = logger.fork('PIXELMATCH FAILED');
    diffLog.error(`[STATIC VISUAL] Visual mismatch detected! ${numDiffPixels} pixels differ. Diff saved to: ${diffPath}`);
    diffLog.error(`Evaluated Target DOM saved to: ${evaluatedHtmlPath}`);
    
    // Find the FIRST Y-coordinate with an error to identify the start of the cascade
    let firstY = -1;
    let firstX = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) * 4;
        if (diff.data[idx] === 255 && diff.data[idx+1] === 0 && diff.data[idx+2] === 0) {
          firstY = y;
          firstX = x;
          break;
        }
      }
      if (firstY !== -1) break;
    }

    if (firstY !== -1) {
      diffLog.error(`First visual discrepancy detected at X: ${firstX}, Y: ${firstY}.`);
      const failingNodes = await page2.evaluate(({ x, y }) => {
        window.scrollTo(0, Math.max(0, y - window.innerHeight / 2));
        const viewY = y - window.scrollY;
        const elements = document.elementsFromPoint(x, viewY);
        return elements.map(el => {
          const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '';
          return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + cls;
        });
      }, { x: firstX, y: firstY });
      diffLog.error(`Elements located at mismatch coordinate:`);
      failingNodes.forEach(n => diffLog.error(`  -> ${n}`));
    }
    
    visualPageErrors++;
  } else {
    logger.log(`[PIXELMATCH] 0 pixels differ (Visuals match).`);
  }

  return { visualPageErrors, visualComponentErrors };
}
