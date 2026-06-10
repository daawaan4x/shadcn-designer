import { PhaseInput, PhaseOutput } from './shared';

export async function phase2ComputedStyle(input: PhaseInput): Promise<PhaseOutput & { allUxDiffs: any[], uxMismatchCount: number }> {
  const { page1, page2, viewport, logger, cdp1, cdp2 } = input;
  let errors = 0;

  const getStyles = () => {
    return Array.from(document.body.querySelectorAll('*')).map(el => {
       const s = window.getComputedStyle(el);
       const styles: Record<string, string> = {};
       for (let i = 0; i < s.length; i++) {
         const prop = s[i];
         if (!prop.startsWith('--')) {
           styles[prop] = s.getPropertyValue(prop);
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
         let path = [];
         let curr: Element | null = el;
         while (curr && curr.tagName.toLowerCase() !== 'body') {
           const typeAttr = curr.getAttribute('type');
           const typeStr = typeAttr ? `[type="${typeAttr}"]` : '';
           const classStr = curr.className && typeof curr.className === 'string' 
             ? '.' + curr.className.trim().split(/\s+/).join('.') 
             : '';
           path.unshift(curr.tagName.toLowerCase() + typeStr + classStr);
           curr = curr.parentElement;
         }
         if (path.length === 0) return 'body';
         return path.join(' > ');
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
  const allStyleDiffs: any[] = [];
  const allUxDiffs: any[] = [];
  
  for (let i = 0; i < Math.min(styles1.length, styles2.length); i++) {
    const s1 = styles1[i] as any;
    const s2 = styles2[i] as any;
    if (s1.tag.split('.')[0] !== s2.tag.split('.')[0]) continue;
    
    const diffs = [];
    let hint = null;

    for (const key of Object.keys(s1.styles)) {
      if (['width', 'height', 'inline-size', 'block-size', 'top', 'bottom', 'left', 'right', 'x', 'y', 'perspective-origin', 'transform-origin', 'tab-size', 'text-size-adjust', '-webkit-tap-highlight-color', 'outline-offset', 'outline-style', 'outline-width', 'outline-color'].includes(key)) continue;
      
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
        val1 = val1.trim();
        val2 = val2.trim();
      }

      if (val1 === val2) continue;
      
      // Ignore text/font inheritance differences on checkboxes, radios, and range inputs
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
      
      // Tailwind Preflight Hints Engine
      if (s1.tag.includes('svg') && (key === 'display' || key === 'vertical-align' || key === 'flex-shrink')) {
         hint = `Hint: Tailwind Preflight sets SVGs to block/middle and strips flex-shrink. Use 'inline', 'align-baseline', or 'shrink-0'`;
      }
      if ((s1.tag.includes('input') || s1.tag.includes('button') || s1.tag.includes('select') || s1.tag.includes('textarea')) && (key === 'font-family' || key === 'line-height')) {
         hint = `Hint: Tailwind Preflight strips font inheritance on form controls. Add 'font-body', 'leading-[normal]', etc.`;
      }
      if (s1.tag.includes('button') && key.includes('border') && val2 === 'rgba(0, 0, 0, 0)') {
         hint = `Hint: Tailwind Preflight resets button border colors to transparent.`;
      }
      if (key.includes('border-radius') && val2 === '8px' && val1 === '4px') {
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
    // AGGREGATION LOGIC
    const grouped = new Map<string, any>();
    for (const item of allStyleDiffs) {
      const hashKey = JSON.stringify({ diffs: item.diffs, missing: item.missingClasses, hint: item.hint });
      if (!grouped.has(hashKey)) {
        grouped.set(hashKey, { ...item, indices: [item.index], count: 1 });
      } else {
        const group = grouped.get(hashKey);
        group.count++;
        group.indices.push(item.index);
      }
    }

    const aggregatedDiffs = Array.from(grouped.values());
    const vpStr = viewport ? `[Viewport ${viewport.width}x${viewport.height}]` : '';
    const styleLog = logger.fork(`COMPUTED STYLE MISMATCHES (${styleMismatchCount} elements) ${vpStr}`);

    // CDP FETCHING FOR AGGREGATED GROUPS
    if (cdp1 && cdp2) {
      const doc1 = await cdp1.send('DOM.getDocument', { depth: -1, pierce: true });
      const doc2 = await cdp2.send('DOM.getDocument', { depth: -1, pierce: true });
      
      await Promise.all(aggregatedDiffs.map(async (group) => {
        try {
          const repIndex = group.indices[0];
          const n1 = await cdp1.send('DOM.querySelector', { nodeId: doc1.root.nodeId, selector: `[data-pl-id="${repIndex}"]` });
          const n2 = await cdp2.send('DOM.querySelector', { nodeId: doc2.root.nodeId, selector: `[data-pl-id="${repIndex}"]` });
          const matched1 = await cdp1.send('CSS.getMatchedStylesForNode', { nodeId: n1.nodeId });
          const matched2 = await cdp2.send('CSS.getMatchedStylesForNode', { nodeId: n2.nodeId });
          
          group.cdpContext = { orig: matched1, tw: matched2 };
        } catch (e) {
          console.error('CDP FETCH ERROR:', e);
        }
      }));
    }
    
    type DiffDetail = { count: number, orig: Set<string>, tw: Set<string> };
    const ruleToFailures = new Map<string, { 
       details: Map<string, DiffDetail>,
       affected: Map<string, Set<number>> 
    }>();

    aggregatedDiffs.forEach(group => {
      if (group.cdpContext) {
         const getValidRules = (matched: any) => matched?.matchedCSSRules?.filter((r: any) => {
           if (r.rule?.origin !== 'regular') return false;
           // Filter out injected stabilization styles
           const properties = r.rule.style?.cssProperties;
           if (properties?.some((p: any) => p.name === 'transition' && p.value === 'none !important')) return false;
           return true;
         }) || [];
         const rules1 = getValidRules(group.cdpContext.orig);
         
         const mismatchedKeys = group.diffs.map((d: any) => d.key);
         const keyToRule = new Map<string, string>();
         
         for (const key of mismatchedKeys) {
           let found = false;
           for (const r of rules1) {
             const hasProp = r.rule.style?.cssProperties?.find((p: any) => p.name === key);
             if (hasProp) {
               const selector = r.rule.selectorList.text;
               const line = r.rule.style.range ? r.rule.style.range.startLine + 1 : '?';
               let mq = '';
               if (r.rule.media && r.rule.media.length > 0) {
                 mq = r.rule.media.map((m: any) => m.text).join(' and ') + ' ';
               }
               keyToRule.set(key, `${mq}${selector} (line: ${line})`);
               found = true;
               break;
             }
           }
           if (!found) {
             keyToRule.set(key, `[Unmapped / Browser Default]`);
           }
         }
         
         for (const [key, ruleStr] of keyToRule.entries()) {
           if (!ruleToFailures.has(ruleStr)) ruleToFailures.set(ruleStr, { details: new Map(), affected: new Map() });
           
           const entry = ruleToFailures.get(ruleStr)!;
           
           const elementKey = `<${group.tag}${group.twClassName ? ` class="${group.twClassName}"` : ''}>`;
           if (!entry.affected.has(elementKey)) {
              entry.affected.set(elementKey, new Set());
           }
           const affectedSet = entry.affected.get(elementKey)!;
           group.indices.forEach((idx: number) => affectedSet.add(idx));
           
           if (!entry.details.has(key)) {
             entry.details.set(key, { count: 0, orig: new Set(), tw: new Set() });
           }
           const propDetail = entry.details.get(key)!;
           propDetail.count += group.count;
           
           const diffVal = group.diffs.find((d: any) => d.key === key);
           if (diffVal) {
             propDetail.orig.add(diffVal.orig);
             propDetail.tw.add(diffVal.tw);
           }
         }
      } else {
         // If CDP failed for some reason, we log it as unmapped
         group.diffs.forEach((d: any) => {
           const ruleStr = `[CDP Unavailable]`;
           if (!ruleToFailures.has(ruleStr)) ruleToFailures.set(ruleStr, { details: new Map(), affected: new Map() });
           const entry = ruleToFailures.get(ruleStr)!;
           
           const elementKey = `<${group.tag}${group.twClassName ? ` class="${group.twClassName}"` : ''}>`;
           if (!entry.affected.has(elementKey)) {
              entry.affected.set(elementKey, new Set());
           }
           const affectedSet = entry.affected.get(elementKey)!;
           group.indices.forEach((idx: number) => affectedSet.add(idx));
           
           if (!entry.details.has(d.key)) {
             entry.details.set(d.key, { count: 0, orig: new Set(), tw: new Set() });
           }
           const propDetail = entry.details.get(d.key)!;
           propDetail.count += group.count;
           propDetail.orig.add(d.orig);
           propDetail.tw.add(d.tw);
         });
      }
    });

    if (ruleToFailures.size > 0) {
      const globalMapLog = styleLog.fork('Many-To-Many Mapping (CSS Definition -> Expected vs Actual & Affected Nodes)');
      for (const [ruleStr, entry] of ruleToFailures.entries()) {
        let totalUniqueNodes = 0;
        for (const indicesSet of entry.affected.values()) {
           totalUniqueNodes += indicesSet.size;
        }

        const detailsLog = globalMapLog.fork(`${ruleStr} (Affected ${totalUniqueNodes} unique nodes)`);
        
        const affectedLog = detailsLog.fork('Affected Nodes');
        for (const [elementKey, indicesSet] of entry.affected.entries()) {
           const indices = Array.from(indicesSet);
           const indicesStr = indices.length > 5 ? `${indices.slice(0, 5).join(', ')} ...(+${indices.length - 5})` : indices.join(', ');
           affectedLog.log(`${elementKey} (Indices: ${indicesStr})`);
        }

        const propsLog = detailsLog.fork('Mismatched Properties');
        for (const [prop, detail] of entry.details.entries()) {
           const origVals = Array.from(detail.orig).join(' | ');
           const twVals = Array.from(detail.tw).join(' | ');
           propsLog.log(`${prop}: expected '${origVals}', got '${twVals}' (${detail.count} occurrences)`);
        }
      }
    }

    // CSS errors are diagnostics, not test failures
    // errors += styleMismatchCount;
  } else {
    logger.log(`COMPUTED STYLE MATCHED PERFECTLY`);
  }

  return { cssErrors: styleMismatchCount, allUxDiffs, uxMismatchCount };
}
