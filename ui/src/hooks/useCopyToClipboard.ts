import { useCallback, useEffect, useRef, useState } from 'react'
import { copyToClipboard } from '../utils/copyToClipboard'

const FEEDBACK_MS = 2000

export type CopyStatus = 'idle' | 'copied' | 'failed'

// Wraps copyToClipboard with brief feedback state for one or more copy buttons: `copiedKey` is the
// key of the button that last succeeded (reset after ~2s), `failed` is true when both clipboard
// routes failed. `message` is the text for an aria-live status region.
export function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(async (text: string, key = 'default') => {
    const ok = await copyToClipboard(text)
    if (timer.current) clearTimeout(timer.current)
    setFailed(!ok)
    setCopiedKey(ok ? key : null)
    timer.current = setTimeout(() => {
      setCopiedKey(null)
      setFailed(false)
    }, FEEDBACK_MS)
    return ok
  }, [])

  return { copy, copiedKey, failed }
}
