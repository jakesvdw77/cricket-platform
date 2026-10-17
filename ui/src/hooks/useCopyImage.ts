import { useCallback, useState } from 'react'

// Whether this browser can put an image on the clipboard (ClipboardItem plus an async clipboard write).
export const canCopyImageToClipboard = (): boolean =>
  typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.clipboard?.write === 'function'

// Copies a PNG file to the clipboard as an image, with the status text for a role=status region: `status` after a success,
// `failure` after a failed attempt, `message` whichever applies (failure first).
export function useCopyImage() {
  const [status, setStatus] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const copyImage = useCallback(async (file: File | null): Promise<boolean> => {
    if (!file) return false
    setFailure(null)
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })])
      setStatus('Image copied.')
      return true
    } catch {
      setStatus(null)
      setFailure("Couldn't copy the image. Download it instead.")
      return false
    }
  }, [])

  return { canCopyImage: canCopyImageToClipboard(), copyImage, status, failure, message: failure ?? status }
}
