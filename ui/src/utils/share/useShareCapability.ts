import { useMemo } from 'react'

// docs/specs/114-share-result.md (Preview and delivery): what this browser can share. The primary action is chosen from
// it, not from a setting: Share where files can be handed to the share sheet, otherwise Download plus Copy text.
// Sharing needs a secure context; without one both answers are false and the Download path is used.

export interface ShareCapability {
  // navigator.share exists (text can be handed to the share sheet).
  canShareText: boolean
  // navigator.canShare says this file can be shared.
  canShareFiles: (file: File) => boolean
}

export function detectShareCapability(): ShareCapability {
  const secure = typeof window !== 'undefined' && window.isSecureContext !== false
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const canShareText = secure && typeof nav?.share === 'function'
  const canShareFiles = (file: File): boolean => {
    if (!secure || typeof nav?.share !== 'function' || typeof nav?.canShare !== 'function') return false
    try {
      return nav.canShare({ files: [file] })
    } catch {
      return false
    }
  }
  return { canShareText, canShareFiles }
}

export function useShareCapability(): ShareCapability {
  return useMemo(detectShareCapability, [])
}
