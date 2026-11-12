// jsdom does not evaluate media queries or grid-template-columns, so getComputedStyle cannot see responsive MUI rules.
// This reads the emotion rules injected into the document for an element's classes instead, so a test can assert the
// written rule (for example `minmax(0,1fr)` or `min-width:76px`); all whitespace is removed, so write expectations without spaces rather than a computed value.
export function cssRulesFor(el: Element): string {
  const classes = Array.from(el.classList).filter((c) => c.startsWith('css-'))
  const sheet = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n')
  return classes
    .flatMap((cls) => sheet.split('}').filter((rule) => rule.includes(`.${cls}`) && !rule.includes(`.${cls} `) && !rule.includes(`.${cls}:`)))
    .join('}\n')
    .replace(/\s+/g, '')
}
