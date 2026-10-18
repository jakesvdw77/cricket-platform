import { useEffect, useMemo, useState } from 'react'
import { loadShareLogos } from '../../utils/share/resultImage'

// Loads the logo images the Image, TV and attached-image generators draw (a url that fails resolves to null, so the logo is
// simply skipped). Already loaded urls are kept; the map is replaced only when something new arrived.
export function useShareLogoImages(urls: string[]): Map<string, HTMLImageElement | null> {
  const key = JSON.stringify([...new Set(urls.filter(Boolean))].sort())
  const wanted = useMemo(() => JSON.parse(key) as string[], [key])
  const [images, setImages] = useState<Map<string, HTMLImageElement | null>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    const missing = wanted.filter((url) => !images.has(url))
    if (missing.length === 0) return
    void loadShareLogos(missing).then((loaded) => {
      if (!cancelled) setImages((current) => new Map([...current, ...loaded]))
    })
    return () => {
      cancelled = true
    }
    // `images` is read only to skip urls already loaded; adding it would reload on every arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted])

  return images
}
