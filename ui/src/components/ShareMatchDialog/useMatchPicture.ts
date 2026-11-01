import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PICTURE_SETTINGS } from '../../utils/share/matchImage'
import type { PictureSettings } from '../../utils/share/matchImage'
import type { MatchPictureState } from './matchScreenTypes'

const MAX_PICTURE_BYTES = 15 * 1024 * 1024

// docs/specs/131 (Team selection poster): the picture is a local File read through an object URL; it is never uploaded or
// stored, and it is released when the dialog closes (`active` false).
export function useMatchPicture(active: boolean): MatchPictureState {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<PictureSettings>(DEFAULT_PICTURE_SETTINGS)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  const release = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }, [])

  const remove = useCallback(() => {
    release()
    setImage(null)
    setName(null)
    setError(null)
  }, [release])

  const choose = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Choose an image file.')
        return
      }
      if (file.size > MAX_PICTURE_BYTES) {
        setError('That picture is too large. Choose one under 15 MB.')
        return
      }
      release()
      const url = URL.createObjectURL(file)
      urlRef.current = url
      const element = new Image()
      element.onload = () => {
        if (urlRef.current !== url) return
        setImage(element)
        setName(file.name)
        setError(null)
      }
      element.onerror = () => {
        if (urlRef.current === url) setError('That picture could not be opened.')
      }
      element.src = url
    },
    [release],
  )

  useEffect(() => {
    if (!active) {
      remove()
      setSettingsState(DEFAULT_PICTURE_SETTINGS)
    }
  }, [active, remove])
  useEffect(() => release, [release])

  return { image, name, settings, choose, remove, setSettings: (patch) => setSettingsState((current) => ({ ...current, ...patch })), error }
}
