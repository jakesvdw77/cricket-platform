import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { drawResultImage } from '../../utils/share/resultImage'
import type { ResultImageOptions } from '../../utils/share/resultImage'
import type { ShareResultModel } from '../../utils/share/shareResultData'

export const IMAGE_ERROR = 'The image could not be created. Try again, or choose another template.'

// Draws the result image into the preview canvas (debounced) with the SAME generator the file comes from, then reads the
// canvas back as the PNG file, so what is shown is what is shared. `model` and `options` must be memoised by the caller.
export function useResultImageOutput(model: ShareResultModel, options: ResultImageOptions, fileName: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useMemo(() => ({ model, options }), [model, options])
  const debounced = useDebouncedValue(input, 150)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    try {
      drawResultImage(canvas, debounced.model, debounced.options)
    } catch {
      setError(IMAGE_ERROR)
      setFile(null)
      return
    }
    canvas.toBlob((blob) => {
      if (cancelled) return
      if (!blob) {
        setError(IMAGE_ERROR)
        setFile(null)
        return
      }
      setError(null)
      setFile(new File([blob], fileName, { type: 'image/png' }))
    }, 'image/png')
    return () => {
      cancelled = true
    }
  }, [debounced, fileName])

  return { canvasRef, file, error }
}
