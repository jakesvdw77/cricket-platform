import { useLayoutEffect, useRef, useState } from 'react'

export interface FillViewportHeightOptions {
  // Below this the box stops shrinking and the page scrolls instead.
  minHeight?: number
  // Space kept below the box inside the page (the shell's bottom padding), in px.
  bottomPadding?: number
}

// docs/specs/085 (D1): the height that makes an element end at the bottom of the window, measured from where it
// starts: window.innerHeight - its top offset in the document - the space the page keeps below it (bottomPadding
// plus the page footer, if there is one: ManagerShell renders <footer> in normal flow below <main>, so its height
// is space the box must leave; no footer means 0) - never less than minHeight. Re-measured on window resize, orientation
// change and whenever the page body changes size (a filter row wrapping, an alert appearing). Use the returned
// `ref` as a callback ref (the element may mount later, e.g. after the data has loaded); `height` is undefined until
// the first measurement.
export function useFillViewportHeight<T extends HTMLElement>({ minHeight = 150, bottomPadding = 24 }: FillViewportHeightOptions = {}) {
  const [element, setElement] = useState<T | null>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  // What the formula below could not see (space the page keeps below the box that it does not account for), learned
  // from the settled layout and added to every later measurement.
  const correction = useRef(0)

  useLayoutEffect(() => {
    if (!element) return undefined
    const measure = () => {
      const top = element.getBoundingClientRect().top + window.scrollY
      const footer = document.querySelector('footer')
      const footerHeight = footer ? footer.getBoundingClientRect().height : 0
      const next = Math.max(minHeight, Math.floor(window.innerHeight - top - bottomPadding - footerHeight + correction.current))
      setHeight((current) => (current === next ? current : next))
      settle()
    }
    // After the height is applied: if the page still leaves room below the box (main stretched past its content) or
    // overflows the window, move the box by exactly that much. Bounded, and a no-op in jsdom (no <main>).
    let frame = 0
    const settle = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const main = element.closest('main')
        const last = main?.lastElementChild
        if (!main || !last) return
        const mainRect = main.getBoundingClientRect()
        const padBottom = parseFloat(window.getComputedStyle(main).paddingBottom) || 0
        const slack = Math.floor(mainRect.bottom - (last.getBoundingClientRect().bottom + padBottom))
        const overflow = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        const delta = slack - overflow
        if (Math.abs(delta) <= 1) return
        correction.current += delta
        setHeight(Math.max(minHeight, Math.floor(element.getBoundingClientRect().height + delta)))
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    // jsdom has no ResizeObserver.
    // Watch the page body and the box's own container and earlier siblings (the filter row, alerts), so content above
    // the box growing OR shrinking re-measures even when the body's size does not change.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (observer) {
      observer.observe(document.body)
      // Every ancestor's earlier siblings too (a hub header or switch above the page's own container).
      let ancestor: HTMLElement | null = element.parentElement
      while (ancestor && ancestor !== document.body) {
        observer.observe(ancestor)
        let sibling = ancestor.previousElementSibling
        while (sibling) {
          observer.observe(sibling)
          sibling = sibling.previousElementSibling
        }
        ancestor = ancestor.parentElement
      }
    }
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      observer?.disconnect()
    }
  }, [element, minHeight, bottomPadding])

  return { ref: setElement, height }
}
