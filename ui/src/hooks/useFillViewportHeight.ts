import { useLayoutEffect, useState } from 'react'

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

  useLayoutEffect(() => {
    if (!element) return undefined
    const measure = () => {
      const top = element.getBoundingClientRect().top + window.scrollY
      const footer = document.querySelector('footer')
      const footerHeight = footer ? footer.getBoundingClientRect().height : 0
      const next = Math.max(minHeight, Math.floor(window.innerHeight - top - bottomPadding - footerHeight))
      setHeight((current) => (current === next ? current : next))
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
      const parent = element.parentElement
      if (parent) {
        observer.observe(parent)
        let sibling = parent.previousElementSibling
        while (sibling) {
          observer.observe(sibling)
          sibling = sibling.previousElementSibling
        }
      }
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      observer?.disconnect()
    }
  }, [element, minHeight, bottomPadding])

  return { ref: setElement, height }
}
