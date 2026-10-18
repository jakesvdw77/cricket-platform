import { useMemo } from 'react'
import { useShareCapability } from '../../utils/share/useShareCapability'

// docs/specs/114-share-result.md "Send to WhatsApp": a WhatsApp or Facebook link carries text only. Only the native share sheet
// can send the image together with the text, so this is true only where this browser can share the PNG file (the rule
// WhatsAppSendActions uses to show Share with a file). While the image is still being made a probe PNG stands in for it, so the
// screen does not flip layout when the file arrives.
export function useCanShareImageWithText(image: File | null): boolean {
  const capability = useShareCapability()
  const probe = useMemo(() => new File([], 'result.png', { type: 'image/png' }), [])
  // A desktop browser (fine pointer) may report that it can share files, but its share sheet has been seen dropping the text of a
  // message (WhatsApp Desktop kept only a link), so the image travelling with the text is promised on touch devices only.
  const touch = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return touch && capability.canShareFiles(image ?? probe)
}
