import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const designDir = path.resolve(__dirname, '../../../design');

// Get all original .html files in the design directory
const allFiles = fs.readdirSync(designDir);
const originalHtmlFiles = allFiles.filter(
  (file) => file.endsWith('.html') && !file.endsWith('.tw.html')
);

const freezeTransitions = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
`;

for (const htmlFile of originalHtmlFiles) {
  const baseName = htmlFile.replace('.html', '');
  const twHtmlFile = `${baseName}.tw.html`;

  test.describe(`Visual Regression: ${baseName}`, () => {
    const hasTwFile = allFiles.includes(twHtmlFile);

    test(`compares ${htmlFile} vs ${twHtmlFile} live`, async ({ context }) => {
      test.skip(!hasTwFile, `Skipping because ${twHtmlFile} does not exist yet.`);

      const page1 = await context.newPage();
      const page2 = await context.newPage();

      // 1. Capture Original HTML Snapshot
      await page1.goto(`/${htmlFile}`);
      await page1.waitForLoadState('networkidle');
      
      // 2. Capture Tailwind HTML Snapshot
      await page2.goto(`/${twHtmlFile}`);
      await page2.waitForLoadState('networkidle');

      // Inject script to ensure fonts and animations are settled if any
      await Promise.all([
        page1.evaluate(() => document.fonts.ready),
        page2.evaluate(() => document.fonts.ready)
      ]);

      // Freeze transitions
      await Promise.all([
        page1.addStyleTag({ content: freezeTransitions }),
        page2.addStyleTag({ content: freezeTransitions })
      ]);

      // NEW: RELATIVE DOM LAYOUT SHIFT DETECTION
      const getLayout = () => {
        const getDepth = (el: Element) => { let d = 0; while(el.parentElement) { d++; el = el.parentElement; } return d; };
        return Array.from(document.body.querySelectorAll('*')).map(el => {
          const rect = el.getBoundingClientRect();
          const pRect = el.parentElement ? el.parentElement.getBoundingClientRect() : { x: 0, y: 0 };
          let idStr = el.tagName.toLowerCase();
          if (el.id) idStr += `#${el.id}`;
          if (typeof el.className === 'string' && el.className) {
            const cls = el.className.split(' ').filter(Boolean).join('.');
            if (cls) idStr += `.${cls}`;
          }
          
          const children = Array.from(el.childNodes).map((child) => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const r = (child as Element).getBoundingClientRect();
              return { type: 'element', tag: (child as Element).tagName.toLowerCase(), h: Math.ceil(r.height) };
            } else if (child.nodeType === Node.TEXT_NODE && child.textContent && child.textContent.trim()) {
              const range = document.createRange();
              range.selectNodeContents(child);
              const r = range.getBoundingClientRect();
              return { type: 'text', text: child.textContent.trim().substring(0, 15), h: Math.ceil(r.height) };
            }
            return null;
          }).filter(Boolean);
          
          return { 
            tag: idStr, 
            relX: Math.floor(rect.x - pRect.x), 
            relY: Math.floor(rect.y - pRect.y), 
            w: Math.ceil(rect.width), 
            h: Math.ceil(rect.height),
            depth: getDepth(el),
            absY: Math.floor(rect.y),
            children
          };
        });
      };
      
      // Inject IDs for CDP mapping
      await page1.evaluate(() => document.body.querySelectorAll('*').forEach((el, i) => el.setAttribute('data-pl-id', i.toString())));
      await page2.evaluate(() => document.body.querySelectorAll('*').forEach((el, i) => el.setAttribute('data-pl-id', i.toString())));

      const l1 = await page1.evaluate(getLayout);
      const l2 = await page2.evaluate(getLayout);
      
      let diagnosticsReport = '';
      function logDiag(msg: string) {
        console.error(msg);
        diagnosticsReport += msg + '\n';
      }
      
      const layoutDiffs = [];
      for (let i = 0; i < Math.min(l1.length, l2.length); i++) {
        const n1 = l1[i];
        const n2 = l2[i];
        if (n1.tag.split('.')[0] !== n2.tag.split('.')[0]) continue;
        
        const issues = [];
        if (Math.abs(n1.relX - n2.relX) > 1) issues.push(`relX: orig ${n1.relX} vs tw ${n2.relX}`);
        if (Math.abs(n1.relY - n2.relY) > 1) issues.push(`relY: orig ${n1.relY} vs tw ${n2.relY}`);
        if (Math.abs(n1.w - n2.w) > 1) issues.push(`width: orig ${n1.w} vs tw ${n2.w}`);
        if (Math.abs(n1.h - n2.h) > 1) {
          issues.push(`height: orig ${n1.h} vs tw ${n2.h}`);
          issues.push(`    orig children: ${n1.children.map((c: any) => `${c.type === 'text' ? `"${c.text}..."` : `<${c.tag}>`}:${c.h}px`).join(', ')}`);
          issues.push(`    tw children: ${n2.children.map((c: any) => `${c.type === 'text' ? `"${c.text}..."` : `<${c.tag}>`}:${c.h}px`).join(', ')}`);
        }
        
        if (issues.length > 0) {
          layoutDiffs.push({ tag: n1.tag, index: i, issues, absY: n1.absY, depth: n1.depth });
        }
      }

      // Group layout diffs logically
      if (layoutDiffs.length > 0) {
        logDiag(`\n=== 🔍 RELATIVE DOM LAYOUT SHIFTS DETECTED (${layoutDiffs.length} elements) ===`);
        logDiag(`These are root-cause layout mismatches. Child elements inherit their parent's shifts and are NOT listed here unless they uniquely shifted relative to their parent.\n`);
        
        // Sort by DOM depth (shallowest first) to find the absolute root causes
        layoutDiffs.sort((a, b) => a.depth - b.depth || a.absY - b.absY);
        
        layoutDiffs.slice(0, 15).forEach(diff => {
          logDiag(`Root Cause <${diff.tag}> (Index ${diff.index}):`);
          diff.issues.forEach(iss => logDiag(`  - ${iss}`));
        });
        if (layoutDiffs.length > 15) logDiag(`...and ${layoutDiffs.length - 15} more layout differences.`);
      }

      // SHARED COMPUTED STYLE DIFFING
      const getStyles = () => {
        return Array.from(document.body.querySelectorAll('*')).map(el => {
           const s = window.getComputedStyle(el);
           const styles: Record<string, string> = {};
           for (let i = 0; i < s.length; i++) {
             const prop = s[i];
             styles[prop] = s.getPropertyValue(prop);
           }
           
           // Explicitly probe known theme tokens in case browser engine omits them from iteration
           const knownTokens = ['--bg', '--fg', '--border', '--accent', '--accent-fg', '--muted', '--muted-fg', '--card', '--ring', '--radius', '--radius-lg', '--font-display', '--font-support', '--font-body', '--font-mono', '--shadow', '--ease', '--sidebar-width', '--nav-height'];
           for (const token of knownTokens) {
             const val = s.getPropertyValue(token);
             if (val && !styles[token]) {
               styles[token] = val;
             }
           }
           // Fetch UX properties separately so we can log them under UX Audit
           const uxStyles: Record<string, string> = {};
           for (const p of ['transition-property', 'transition-duration', 'transition-timing-function', 'animation']) {
             uxStyles[p] = s.getPropertyValue(p);
           }
           
           // Fetch Pseudo-Elements and Native Shadow DOM properties
           const pseudoElements = [
             '::placeholder',
             '::before', 
             '::after',
             '::-webkit-slider-thumb',
             '::-webkit-slider-runnable-track',
             '::-webkit-search-cancel-button',
             '::-webkit-inner-spin-button'
           ];

           for (const pseudo of pseudoElements) {
              const ps = window.getComputedStyle(el, pseudo);
              if (ps) {
                if (pseudo === '::placeholder') {
                  const tag = el.tagName.toLowerCase();
                  if (tag === 'input') {
                    const type = el.getAttribute('type');
                    if (['checkbox', 'radio', 'range', 'color', 'file'].includes(type || '')) continue;
                  }
                }
                const propsToTrack = ['content', 'color', 'opacity', 'background-color', 'border-color', 'border-width', 'border-style', 'font-size', 'line-height', 'display', 'position', 'width', 'height'];
                if (pseudo === '::placeholder' || (ps.content && ps.content !== 'none' && ps.content !== 'normal' && ps.display !== 'none')) {
                 for (const prop of propsToTrack) {
                   const val = ps.getPropertyValue(prop);
                   if (val && val !== 'none' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
                     styles[`${pseudo} ${prop}`] = val;
                   }
                 }
               }
             }
           }
           
           // Walk the DOM tree
           function getTag(el: Element) {
             const typeAttr = el.getAttribute('type');
             const typeStr = typeAttr ? `[type="${typeAttr}"]` : '';
             const classStr = el.className && typeof el.className === 'string' 
               ? '.' + el.className.trim().split(/\s+/).join('.') 
               : '';
             return el.tagName.toLowerCase() + typeStr + classStr;
           }

           const missingArbitraryClasses: string[] = [];
           const generatedCss = document.getElementById('tailwindcss')?.textContent || '';
           if (typeof el.className === 'string') {
             const clsArr = el.className.split(/\s+/);
             for (const c of clsArr) {
               if (c.includes('[') && c.includes(']')) {
                 const escapedCls = '.' + c.replace(/([\[\]\(\)%,\._])/g, '\\$1');
                 if (!generatedCss.includes(escapedCls) && generatedCss.length > 0) {
                   missingArbitraryClasses.push(c);
                 }
               }
             }
           }
           
           return { tag: getTag(el), className: typeof el.className === 'string' ? el.className : '', styles, uxStyles, missingArbitraryClasses };
        });
      };

      const styles1 = await page1.evaluate(getStyles);
      const styles2 = await page2.evaluate(getStyles);

      let styleMismatchCount = 0;
      let uxMismatchCount = 0;
      const allStyleDiffs = [];
      const allUxDiffs = [];
      
      for (let i = 0; i < Math.min(styles1.length, styles2.length); i++) {
        const s1 = styles1[i] as any;
        const s2 = styles2[i] as any;
        if (s1.tag.split('.')[0] !== s2.tag.split('.')[0]) continue;
        
        const diffs = [];
        let hint = null;

        for (const key of Object.keys(s1.styles)) {
          if (['width', 'height', 'top', 'bottom', 'left', 'right', 'x', 'y', 'perspective-origin', 'transform-origin', 'tab-size', 'text-size-adjust', '-webkit-tap-highlight-color', 'outline-offset', 'outline-style', 'outline-width', 'outline-color'].includes(key)) continue;
          
          if (key.includes('border') && (key.includes('color') || key.includes('style'))) {
            const isPseudo = key.includes('::');
            const prefix = isPseudo ? key.split(' ')[0] + ' ' : '';
            const edge = key.replace('-color', '').replace('-style', '');
            const widthKey = edge + '-width';
            const globalWidthKey = prefix + 'border-width';
            
            const w1 = s1.styles[widthKey] || s1.styles[globalWidthKey] || '0px';
            const w2 = s2.styles[widthKey] || s2.styles[globalWidthKey] || '0px';
            
            if (w1 === '0px' && w2 === '0px') {
              continue;
            }
          }
          let val1 = s1.styles[key];
          let val2 = s2.styles[key];

          // Normalize box-shadows (Tailwind injects transparent ring shadows)
          if (key === 'box-shadow') {
            val2 = val2.replace(/(rgba?\(0,\s*0,\s*0,\s*0\)\s*0px\s*0px\s*0px\s*0px\s*,\s*)+/g, '');
            // Also normalize spaces before the shadow values
            val1 = val1.trim();
            val2 = val2.trim();
          }

          if (val1 === val2) continue;
          
          // Ignore text/font inheritance differences on checkboxes, radios, and range inputs
          // They don't render text anyway, so differences in computed font/color don't cause visual mismatch
          if (s1.tag.includes('[type="checkbox"]') || s1.tag.includes('[type="radio"]') || s1.tag.includes('[type="range"]')) {
            const ignoredFormProps = ['color', 'font-family', 'font-size', 'line-height', 'letter-spacing', 'column-rule-color', 'text-decoration-color', '-webkit-text-fill-color', 'caret-color', 'text-emphasis-color', '-webkit-text-stroke-color'];
            if (ignoredFormProps.includes(key)) continue;
          }

          // Ignore SVG noise
          if (s1.tag.startsWith('svg') || s1.tag.startsWith('path')) {
            if (key === 'vertical-align' && val1 === 'baseline' && val2 === 'middle') continue;
            if (key === 'fill' && val1 === 'none' && val2 === 'rgb(0, 0, 0)') continue;
          }

          diffs.push({ key, orig: val1, tw: val2 });
            
            // Tailwind Preflight Heuristics Engine
            if (s1.tag.startsWith('svg') && (key === 'display' || key === 'vertical-align' || key === 'flex-shrink')) {
               hint = `Hint: Tailwind Preflight sets SVGs to block/middle and strips flex-shrink. Use 'inline', 'align-baseline', or 'shrink-0'`;
            }
            if ((s1.tag.startsWith('input') || s1.tag.startsWith('button') || s1.tag.startsWith('select') || s1.tag.startsWith('textarea')) && (key === 'font-family' || key === 'line-height')) {
               hint = `Hint: Tailwind Preflight strips font inheritance on form controls. Add 'font-body', 'leading-[normal]', etc.`;
            }
            if (s1.tag.startsWith('button') && key.includes('border') && s2.styles[key] === 'rgba(0, 0, 0, 0)') {
               hint = `Hint: Tailwind Preflight resets button border colors to transparent.`;
            }
            if (key.includes('border-radius') && s2.styles[key] === '8px' && s1.styles[key] === '4px') {
               hint = `Hint: Tailwind 'rounded' usually defaults to 4px, but your config maps it to 8px. Use 'rounded-[4px]' if the original is 4px.`;
            }
            if ((s1.tag.includes('input') || s1.tag.includes('select') || s1.tag.includes('textarea')) && key.includes('margin')) {
               hint = `Hint: Tailwind Preflight strips margins from form controls. Use 'm-[revert]' to restore browser defaults.`;
            }
          }
          
          let boxModelContext = null;
          if (diffs.some((d: any) => d.key === 'block-size' || d.key === 'inline-size')) {
            boxModelContext = ['line-height', 'font-size', 'display', 'box-sizing', 'padding-top', 'padding-bottom', 'margin-top', 'margin-bottom', 'gap', 'row-gap', 'column-gap', 'align-items', 'justify-content', 'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width']
              .filter(k => s1.styles[k] === s2.styles[k] && s1.styles[k] !== '0px' && s1.styles[k] !== 'normal')
              .map(k => `${k}: '${s1.styles[k]}'`);
          }

        if (diffs.length > 0 || (s2.missingArbitraryClasses && s2.missingArbitraryClasses.length > 0)) {
          allStyleDiffs.push({ tag: s1.tag, index: i, diffs, hint, boxModelContext, twClassName: s2.className, missingClasses: s2.missingArbitraryClasses });
          styleMismatchCount++;
        }

        const uxDiffs = [];
        for (const key of Object.keys(s1.uxStyles)) {
          if (s1.uxStyles[key] !== s2.uxStyles[key]) {
            uxDiffs.push({ key, orig: s1.uxStyles[key], tw: s2.uxStyles[key] });
          }
        }
        if (uxDiffs.length > 0) {
          allUxDiffs.push({ tag: s1.tag, index: i, diffs: uxDiffs, twClassName: s2.className });
          uxMismatchCount++;
        }
      }

      if (styleMismatchCount > 0) {
        // --- CDP INHERITANCE CONTEXT ---
        const cdp1 = await page1.context().newCDPSession(page1);
        const cdp2 = await page2.context().newCDPSession(page2);
        await cdp1.send('DOM.enable'); await cdp1.send('CSS.enable');
        await cdp2.send('DOM.enable'); await cdp2.send('CSS.enable');
        const doc1 = await cdp1.send('DOM.getDocument');
        const doc2 = await cdp2.send('DOM.getDocument');

        for (const item of allStyleDiffs.slice(0, 10)) { // Only do first 10 to save time
          try {
            const n1 = await cdp1.send('DOM.querySelector', { nodeId: doc1.root.nodeId, selector: `[data-pl-id="${item.index}"]` });
            const n2 = await cdp2.send('DOM.querySelector', { nodeId: doc2.root.nodeId, selector: `[data-pl-id="${item.index}"]` });
            const matched1 = await cdp1.send('CSS.getMatchedStylesForNode', { nodeId: n1.nodeId });
            const matched2 = await cdp2.send('CSS.getMatchedStylesForNode', { nodeId: n2.nodeId });
            
            item.cdpContext = { orig: matched1, tw: matched2 };
          } catch (e) {
            // Ignore CDP errors
          }
        }

        diagnosticsReport += `\n=== 🎨 COMPUTED STYLE MISMATCHES (${styleMismatchCount} elements) ===\n`;
        allStyleDiffs.forEach(item => {
          diagnosticsReport += `Computed style mismatch on <${item.tag}> (DOM index ${item.index}):\n`;
          if (item.twClassName) diagnosticsReport += `  🏷️ Actual Tailwind Classes: '${item.twClassName}'\n`;
          if (item.missingClasses && item.missingClasses.length > 0) diagnosticsReport += `  🚨 MISSING FROM CSS: ${item.missingClasses.join(', ')}\n`;
          if (item.hint) diagnosticsReport += `  💡 ${item.hint}\n`;
          if (item.boxModelContext && item.boxModelContext.length > 0) {
            diagnosticsReport += `  📦 Box Context: ${item.boxModelContext.join(', ')}\n`;
          }
          item.diffs.forEach((d: any) => {
            diagnosticsReport += `  ${d.key}: original '${d.orig}' but tailwind '${d.tw}'\n`;
          });
          if (item.cdpContext) {
             diagnosticsReport += `  🔍 Inheritance Origin:\n`;
             const lastOrigRule = item.cdpContext.orig.matchedCSSRules?.pop()?.rule?.selectorList?.text || 'inline/inherited';
             const lastTwRule = item.cdpContext.tw.matchedCSSRules?.pop()?.rule?.selectorList?.text || 'inline/inherited';
             diagnosticsReport += `       orig matched last rule: ${lastOrigRule}\n`;
             diagnosticsReport += `       tw matched last rule: ${lastTwRule}\n`;
          }
        });

        console.error(`\n=== 🎨 COMPUTED STYLE MISMATCHES (${styleMismatchCount} elements) ===`);
        allStyleDiffs.slice(0, 20).forEach(item => {
          console.error(`Computed style mismatch on <${item.tag}> (DOM index ${item.index}):`);
          if (item.twClassName) console.error(`  🏷️ Actual Tailwind Classes: '${item.twClassName}'`);
          if (item.missingClasses && item.missingClasses.length > 0) console.error(`  🚨 MISSING FROM CSS: ${item.missingClasses.join(', ')}`);
          if (item.hint) console.error(`  💡 ${item.hint}`);
          if (item.boxModelContext && item.boxModelContext.length > 0) {
            console.error(`  📦 Box Context: ${item.boxModelContext.join(', ')}`);
          }
          item.diffs.slice(0, 5).forEach((d: any) => console.error(`  ${d.key}: original '${d.orig}' but tailwind '${d.tw}'`));
          if (item.diffs.length > 5) console.error(`  ...and ${item.diffs.length - 5} more properties`);
        });
        if (allStyleDiffs.length > 20) console.error(`...and ${allStyleDiffs.length - 20} more styled elements differ.\n`);
      } else {
        diagnosticsReport += `\n=== 🎨 COMPUTED STYLE MATCHED PERFECTLY ===\n`;
      }
      
      // UX AUDIT REPORTING
      let uxAuditReport = `\n=== 🎭 UX & INTERACTIVE AUDIT ===\n`;
      if (uxMismatchCount > 0) {
        uxAuditReport += `\n[UX AUDIT] Transition Mismatches (${uxMismatchCount} elements):\n`;
        allUxDiffs.forEach(item => {
          uxAuditReport += `Transition mismatch on <${item.tag}> (DOM index ${item.index}):\n`;
          if (item.twClassName) uxAuditReport += `  🏷️ Tailwind Classes: '${item.twClassName}'\n`;
          item.diffs.forEach((d: any) => {
             uxAuditReport += `  ${d.key}: orig '${d.orig}' vs tw '${d.tw}'\n`;
          });
        });
        console.error(`\n[UX AUDIT] Transition Mismatches (${uxMismatchCount} elements) detected. Check diagnostics.txt.`);
      }

      // CDP INTERACTIVE STATE DIFFING
      const cdp1 = await page1.context().newCDPSession(page1);
      const cdp2 = await page2.context().newCDPSession(page2);
      await cdp1.send('DOM.enable'); await cdp1.send('CSS.enable');
      await cdp2.send('DOM.enable'); await cdp2.send('CSS.enable');
      const doc1 = await cdp1.send('DOM.getDocument');
      const doc2 = await cdp2.send('DOM.getDocument');

      const interactiveIds = await page1.evaluate(() => {
        return Array.from(document.querySelectorAll('button, a, input, textarea, [tabindex]'))
          .map(el => el.getAttribute('data-pl-id')).filter(Boolean);
      });

      let interactiveMismatches = 0;
      if (interactiveIds.length > 0) {
        uxAuditReport += `\n[UX AUDIT] Interactive State Mismatches (Forced :hover & :focus):\n`;
        
        // Remove freezeTransitions so hover/focus can take effect
        await page1.evaluate(() => {
          const styleNodes = Array.from(document.querySelectorAll('style'));
          for (const s of styleNodes) { if (s.textContent?.includes('transition: none')) s.remove(); }
        });
        await page2.evaluate(() => {
          const styleNodes = Array.from(document.querySelectorAll('style'));
          for (const s of styleNodes) { if (s.textContent?.includes('transition: none')) s.remove(); }
        });

        for (const id of interactiveIds) {
          try {
            const n1 = await cdp1.send('DOM.querySelector', { nodeId: doc1.root.nodeId, selector: `[data-pl-id="${id}"]` });
            const n2 = await cdp2.send('DOM.querySelector', { nodeId: doc2.root.nodeId, selector: `[data-pl-id="${id}"]` });
            
            if (!n1.nodeId || !n2.nodeId) continue;
            
            await cdp1.send('CSS.forcePseudoState', { nodeId: n1.nodeId, forcedPseudoClasses: ['hover', 'focus'] });
            await cdp2.send('CSS.forcePseudoState', { nodeId: n2.nodeId, forcedPseudoClasses: ['hover', 'focus'] });
            
            const extractInteractiveStyles = (id: string) => {
              const el = document.querySelector(`[data-pl-id="${id}"]`);
              if (!el) return null;
              const s = window.getComputedStyle(el);
              const typeAttr = el.getAttribute('type');
              const typeStr = typeAttr ? `[type="${typeAttr}"]` : '';
              return { 
                tag: el.tagName.toLowerCase() + typeStr + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''),
                bg: s.backgroundColor, 
                border: s.borderColor, 
                borderWidth: s.borderWidth,
                borderBottomWidth: s.borderBottomWidth,
                borderStyle: s.borderStyle,
                borderBottomColor: s.borderBottomColor,
                shadow: s.boxShadow, 
                color: s.color, 
                outline: s.outline,
                outlineStyle: s.outlineStyle,
                outlineWidth: s.outlineWidth
              };
            };
            
            const state1 = await page1.evaluate(extractInteractiveStyles, id);
            const state2 = await page2.evaluate(extractInteractiveStyles, id);
            
            await cdp1.send('CSS.forcePseudoState', { nodeId: n1.nodeId, forcedPseudoClasses: [] });
            await cdp2.send('CSS.forcePseudoState', { nodeId: n2.nodeId, forcedPseudoClasses: [] });
            
            if (state1 && state2) {
              const diffs = [];
              if (state1.bg !== state2.bg) diffs.push(`background-color: orig '${state1.bg}' vs tw '${state2.bg}'`);
              
              const b1W = state1.borderWidth;
              const b2W = state2.borderWidth;
              const b1S = state1.borderStyle;
              const b2S = state2.borderStyle;
              const invisibleB1 = b1W === '0px' || b1S === 'none' || state1.border.includes('rgba(0, 0, 0, 0)');
              const invisibleB2 = b2W === '0px' || b2S === 'none' || state2.border.includes('rgba(0, 0, 0, 0)');
              
              if (state1.border !== state2.border && !(invisibleB1 && invisibleB2)) {
                // If it's a composite string (like palette input) check the specific bottom edge if others are 0
                if (b1W !== b2W || state1.borderBottomColor !== state2.borderBottomColor) {
                  diffs.push(`border-color: orig '${state1.border}' vs tw '${state2.border}'`);
                }
              }

              const isNonTextInput = state1.tag.includes('input[type="checkbox"]') || state1.tag.includes('input[type="radio"]') || state1.tag.includes('input[type="range"]');
              if (state1.color !== state2.color && !isNonTextInput) {
                diffs.push(`color: orig '${state1.color}' vs tw '${state2.color}'`);
              }
              
              // Normalize shadows
              let s1 = state1.shadow.trim();
              let s2 = state2.shadow.trim();
              const isTransparentShadow = (s: string) => {
                if (s === 'none') return true;
                const stripped = s.replace(/rgba?\(0,\s*0,\s*0,\s*0\)/g, '').replace(/oklab\(0\s+0\s+0\s*\/\s*0\)/g, '').replace(/transparent/g, '');
                return !stripped.match(/rgb|hsl|oklch|oklab|#/);
              };
              if (isTransparentShadow(s1)) s1 = 'none';
              if (isTransparentShadow(s2)) s2 = 'none';
              if (s1 !== s2) diffs.push(`box-shadow: orig '${s1}' vs tw '${s2}'`);
              
              if (state1.outline !== state2.outline) {
                const invisibleO1 = state1.outlineStyle === 'none' || state1.outlineWidth === '0px' || state1.outline.includes('rgba(0, 0, 0, 0)') || state1.outline.includes('transparent');
                const invisibleO2 = state2.outlineStyle === 'none' || state2.outlineWidth === '0px' || state2.outline.includes('rgba(0, 0, 0, 0)') || state2.outline.includes('transparent');
                if (!(invisibleO1 && invisibleO2)) {
                  diffs.push(`outline: orig '${state1.outline}' vs tw '${state2.outline}'`);
                }
              }
              
              if (diffs.length > 0) {
                interactiveMismatches++;
                uxAuditReport += `Interactive Mismatch on <${state1.tag}> (DOM index ${id}):\n`;
                diffs.forEach(d => { uxAuditReport += `  ${d}\n`; });
              }
            }
          } catch (e) {
            // CDP Node errors
          }
        }
        
        if (interactiveMismatches > 0) {
          console.error(`\n[UX AUDIT] Interactive State Mismatches (${interactiveMismatches} elements) detected. Check diagnostics.txt.`);
        } else {
          uxAuditReport += `All Interactive States (Hover/Focus) Matched Perfectly!\n`;
        }
      }

      if (uxMismatchCount === 0 && interactiveMismatches === 0) {
        uxAuditReport += `All UX and Interactive audits PASSED!\n`;
      }
      
      diagnosticsReport += uxAuditReport;

      const diagPath = path.resolve(__dirname, 'tmp', 'diagnostics.txt');
      fs.mkdirSync(path.dirname(diagPath), { recursive: true });
      fs.writeFileSync(diagPath, diagnosticsReport);

      // PIXELMATCH VISUAL DIFF
      const originalBuffer = await page1.screenshot({ fullPage: true });
      const twBuffer = await page2.screenshot({ fullPage: true });

      const img1 = PNG.sync.read(originalBuffer);
      const img2 = PNG.sync.read(twBuffer);
      
      const width = Math.min(img1.width, img2.width);
      const height = Math.min(img1.height, img2.height);
      const diff = new PNG({ width, height });

      let dimensionMismatch = false;
      if (img1.width !== img2.width || img1.height !== img2.height) {
        console.error(`\n[DIMENSION MISMATCH] Original: ${img1.width}x${img1.height}, Tailwind: ${img2.width}x${img2.height}`);
        dimensionMismatch = true;
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
        console.error(`\n[COMPONENT ISOLATION] Visual mismatch detected in components: ${failingComponents.map(c => c.testId).join(', ')}`);
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

      if (numDiffPixels > 0) {
        const diffPath = path.resolve(__dirname, 'tmp', `${baseName}-diff.png`);
        const evaluatedHtmlPath = path.resolve(__dirname, 'tmp', `${baseName}-evaluated.html`);
        fs.mkdirSync(path.dirname(diffPath), { recursive: true });
        fs.writeFileSync(diffPath, PNG.sync.write(diff));
        
        const evaluatedHtml = await page2.content();
        fs.writeFileSync(evaluatedHtmlPath, evaluatedHtml);
        console.error(`\n=== 📸 PIXELMATCH FAILED ===`);
        console.error(`[STATIC VISUAL] FAIL: Visual mismatch detected! ${numDiffPixels} pixels differ. Diff saved to: ${diffPath}`);
        console.error(`Evaluated Tailwind DOM saved to: ${evaluatedHtmlPath}`);
        
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
          console.error(`First visual discrepancy detected at X: ${firstX}, Y: ${firstY}.`);
          const failingNodes = await page2.evaluate(({ x, y }) => {
            window.scrollTo(0, Math.max(0, y - window.innerHeight / 2));
            const viewY = y - window.scrollY;
            const elements = document.elementsFromPoint(x, viewY);
            return elements.map(el => {
              const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '';
              return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + cls;
            });
          }, { x: firstX, y: firstY });
          console.error(`Elements located at mismatch coordinate: \n  -> ${failingNodes.join('\n  -> ')}`);
        }
      } else {
        console.log(`\n[STATIC VISUAL] PASS: 0 pixels differ. (Screens are pixel-perfect)`);
      }

      if (failingComponents.length > 0) {
        expect(failingComponents.length, `Component visual tests failed for: ${failingComponents.map(c => c.testId).join(', ')}`).toBe(0);
      }

      if (dimensionMismatch) {
        expect(img1.height, 'Heights should match').toBe(img2.height);
        expect(img1.width, 'Widths should match').toBe(img2.width);
      }

      // Assert pixel perfect match and UX parity
      expect(numDiffPixels, `[STATIC VISUAL] Pixel mismatch detected. See logs for Computed Styles and Layout Shifts.`).toBe(0);
      expect(uxMismatchCount + interactiveMismatches, `[UX AUDIT] UX regressions detected! Missing hover/focus states or incorrect transitions. See diagnostics.txt`).toBe(0);
    });
  });
}
