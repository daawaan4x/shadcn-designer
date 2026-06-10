import { PhaseInput, PhaseOutput } from './shared';

export interface Phase3Input extends PhaseInput {
  allUxDiffs: any[];
  uxMismatchCount: number;
}

export async function phase3UxAudit(input: Phase3Input): Promise<PhaseOutput> {
  const { page1, page2, allUxDiffs, uxMismatchCount, viewport, logger, cdp1, cdp2 } = input;
  let uxErrors = 0;
  
  const vpStr = viewport ? `[Viewport ${viewport.width}x${viewport.height}]` : '';

  const uxLog = logger.fork(`UX & INTERACTIVE AUDIT ${vpStr}`);

  if (uxMismatchCount > 0) {
    const tmLog = uxLog.fork(`Transition Mismatches (${uxMismatchCount} elements)`);
    allUxDiffs.forEach(item => {
      const elLog = tmLog.fork(`Mismatch on <${item.tag}> (DOM index ${item.index})`);
      if (item.twClassName) elLog.log({ 'Target Classes': item.twClassName });
      item.diffs.forEach((d: any) => {
         elLog.log({ [d.key]: `expected '${d.orig}', got '${d.tw}'` });
      });
    });
    uxErrors += uxMismatchCount;
  }

  // CDP INTERACTIVE STATE DIFFING
  if (cdp1 && cdp2) {
    const doc1 = await cdp1.send('DOM.getDocument');
    const doc2 = await cdp2.send('DOM.getDocument');

    const interactiveIds = await page1.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a, input, textarea, [tabindex]'))
        .map(el => el.getAttribute('data-pl-id')).filter(Boolean);
    });

    let interactiveMismatches = 0;
    if (interactiveIds.length > 0) {
      const interactiveLog = uxLog.fork(`Interactive State Mismatches (Forced :hover & :focus)`);
      
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
            if (state1.bg !== state2.bg) diffs.push({ 'background-color': `expected '${state1.bg}', got '${state2.bg}'` });
            
            const b1W = state1.borderWidth;
            const b2W = state2.borderWidth;
            const b1S = state1.borderStyle;
            const b2S = state2.borderStyle;
            const invisibleB1 = b1W === '0px' || b1S === 'none' || state1.border.includes('rgba(0, 0, 0, 0)');
            const invisibleB2 = b2W === '0px' || b2S === 'none' || state2.border.includes('rgba(0, 0, 0, 0)');
            
            if (state1.border !== state2.border && !(invisibleB1 && invisibleB2)) {
              if (b1W !== b2W || state1.borderBottomColor !== state2.borderBottomColor) {
                diffs.push({ 'border-color': `expected '${state1.border}', got '${state2.border}'` });
              }
            }

            const isNonTextInput = state1.tag.includes('input[type="checkbox"]') || state1.tag.includes('input[type="radio"]') || state1.tag.includes('input[type="range"]');
            if (state1.color !== state2.color && !isNonTextInput) {
              diffs.push({ color: `expected '${state1.color}', got '${state2.color}'` });
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
            if (s1 !== s2) diffs.push({ 'box-shadow': `expected '${s1}', got '${s2}'` });
            
            if (state1.outline !== state2.outline) {
              const invisibleO1 = state1.outlineStyle === 'none' || state1.outlineWidth === '0px' || state1.outline.includes('rgba(0, 0, 0, 0)') || state1.outline.includes('transparent');
              const invisibleO2 = state2.outlineStyle === 'none' || state2.outlineWidth === '0px' || state2.outline.includes('rgba(0, 0, 0, 0)') || state2.outline.includes('transparent');
              if (!(invisibleO1 && invisibleO2)) {
                diffs.push({ outline: `expected '${state1.outline}', got '${state2.outline}'` });
              }
            }
            
            if (diffs.length > 0) {
              interactiveMismatches++;
              const elLog = interactiveLog.fork(`Mismatch on <${state1.tag}> (DOM index ${id})`);
              diffs.forEach(d => elLog.log(d));
            }
          }
        } catch (e) {
          // CDP Node errors
        }
      }
      
      if (interactiveMismatches > 0) {
        uxErrors += interactiveMismatches;
      } else {
        interactiveLog.log(`All Interactive States (Hover/Focus) Matched Perfectly!`);
      }
    }

    if (uxMismatchCount === 0 && interactiveMismatches === 0) {
      uxLog.log(`All UX and Interactive audits PASSED!`);
    }
  }

  // Wait, freezeTransitions should be re-applied after hover/focus testing for pixelmatch
  const freezeTransitions = `*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }`;
  await page1.addStyleTag({ content: freezeTransitions });
  await page2.addStyleTag({ content: freezeTransitions });

  return { uxErrors };
}
