import { PhaseInput, PhaseOutput } from './shared';

export async function phase1Layout(input: PhaseInput): Promise<PhaseOutput> {
  const { page1, page2, viewport, logger } = input;
  let layoutErrors = 0;

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

  if (layoutDiffs.length > 0) {
    layoutErrors = layoutDiffs.length;
    const layoutLog = logger.fork(`RELATIVE DOM LAYOUT SHIFTS DETECTED (${layoutDiffs.length} elements)`);
    layoutLog.log(`These are root-cause layout mismatches. Child elements inherit their parent's shifts and are NOT listed here unless they uniquely shifted relative to their parent.`);
    
    // Sort by DOM depth (shallowest first) to find the absolute root causes
    layoutDiffs.sort((a, b) => a.depth - b.depth || a.absY - b.absY);
    
    layoutDiffs.slice(0, 15).forEach(diff => {
      const causeLog = layoutLog.fork(`Root Cause <${diff.tag}> (Index ${diff.index})`);
      diff.issues.forEach(iss => causeLog.log(iss));
    });
    if (layoutDiffs.length > 15) layoutLog.log(`...and ${layoutDiffs.length - 15} more layout differences.`);
  } else {
    logger.log(`RELATIVE DOM LAYOUT MATCHED PERFECTLY`);
  }

  // Layout shifts do not strictly increment the "error" count that blocks the test 
  // because pixelmatch will naturally fail if there are layout shifts.
  // But we can return them so we have it.
  
  return { layoutErrors };
}
