import { useEffect } from 'react'

// docs/specs/085 (C8): sets the browser tab (document) title while the caller is mounted and restores the previous
// one on unmount or when the title changes. An empty or undefined title leaves the document title alone.
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return undefined
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
