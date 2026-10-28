import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { generateLeaguePdf } from '../../utils/share/leaguePdf'
import type { LeaguePdfOptions } from '../../utils/share/leaguePdf'
import { drawResultPdfPage } from '../../utils/share/resultPdfPreview'
import type { PdfOp } from '../../utils/share/resultPdf'
import type { LeagueShareModel } from '../../utils/share/shareLeagueData'

export const LEAGUE_PDF_ERROR = 'The PDF could not be created. Try again.'

// Makes the league PDF (debounced) with the generator, then draws the chosen page of the SAME laid-out document into the
// preview canvas, so what is shown is what is shared. `model` and `options` must be memoised by the caller.
export function useLeaguePdfOutput(model: LeagueShareModel, options: LeaguePdfOptions, fileName: string, pixelWidth?: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [made, setMade] = useState<{ input: object; file: File } | null>(null)
  const [pages, setPages] = useState<PdfOp[][]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const input = useMemo(() => ({ model, options }), [model, options])
  const debounced = useDebouncedValue(input, 250)
  const file = made && made.input === input ? made.file : null

  useEffect(() => {
    let cancelled = false
    setMade(null)
    generateLeaguePdf(debounced.model, debounced.options)
      .then((output) => {
        URL.revokeObjectURL(output.url)
        if (cancelled) return
        setError(null)
        setPages(output.pages)
        setMade({ input: debounced, file: new File([output.blob], fileName, { type: 'application/pdf' }) })
      })
      .catch(() => {
        if (cancelled) return
        setError(LEAGUE_PDF_ERROR)
        setPages([])
      })
    return () => {
      cancelled = true
    }
  }, [debounced, fileName])

  const shown = Math.min(pageIndex, Math.max(0, pages.length - 1))
  useEffect(() => {
    const canvas = canvasRef.current
    const ops = pages[shown]
    if (!canvas || !ops) return
    let cancelled = false
    drawResultPdfPage(canvas, ops, pixelWidth).catch(() => {
      if (!cancelled) setError(LEAGUE_PDF_ERROR)
    })
    return () => {
      cancelled = true
    }
  }, [pages, shown, pixelWidth])

  return { canvasRef, file, pageCount: pages.length, pageIndex: shown, setPageIndex, error }
}
