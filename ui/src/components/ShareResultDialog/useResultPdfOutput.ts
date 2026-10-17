import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { generateResultPdf } from '../../utils/share/resultPdf'
import type { PdfOp, ResultPdfOptions } from '../../utils/share/resultPdf'
import { drawResultPdfPage } from '../../utils/share/resultPdfPreview'
import type { ShareResultModel } from '../../utils/share/shareResultData'

export const PDF_ERROR = 'The PDF could not be created. Try again, or choose another template.'

// Makes the PDF (debounced) with the generator, then draws the chosen page of the SAME laid-out document into the preview
// canvas, so what is shown is what is shared. `model` and `options` must be memoised by the caller.
export function useResultPdfOutput(model: ShareResultModel, options: ResultPdfOptions, fileName: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<PdfOp[][]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const input = useMemo(() => ({ model, options }), [model, options])
  const debounced = useDebouncedValue(input, 250)

  useEffect(() => {
    let cancelled = false
    generateResultPdf(debounced.model, debounced.options)
      .then((output) => {
        // The screen keeps its own File; the generator's object URL is not needed here.
        URL.revokeObjectURL(output.url)
        if (cancelled) return
        setError(null)
        setPages(output.pages)
        setFile(new File([output.blob], fileName, { type: 'application/pdf' }))
      })
      .catch(() => {
        if (cancelled) return
        setError(PDF_ERROR)
        setFile(null)
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
    drawResultPdfPage(canvas, ops).catch(() => {
      if (!cancelled) setError(PDF_ERROR)
    })
    return () => {
      cancelled = true
    }
  }, [pages, shown])

  return { canvasRef, file, pageCount: pages.length, pageIndex: shown, setPageIndex, error }
}
