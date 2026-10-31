import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { drawMatchImage } from '../../utils/share/matchImage'
import type { MatchImageOptions } from '../../utils/share/matchImage'
import { generateMatchPdf } from '../../utils/share/matchPdf'
import type { MatchPdfOptions } from '../../utils/share/matchPdf'
import { drawResultPdfPage } from '../../utils/share/resultPdfPreview'
import type { PdfOp } from '../../utils/share/resultPdf'
import type { MatchShareModel } from '../../utils/share/shareMatchData'
import { useShareLogoImages } from '../ShareCore'
import type { MatchScreenProps } from './matchScreenTypes'

export const MATCH_IMAGE_ERROR = 'The image could not be created. Try again, or choose another template.'
export const MATCH_PDF_ERROR = 'The PDF could not be created. Try again.'

type Source = Pick<MatchScreenProps, 'choices' | 'sponsors' | 'selectedSponsorIds' | 'clubLogoUrl' | 'leagueLogoUrl' | 'clubWebsite'>

function sponsorUrlsOf({ sponsors, selectedSponsorIds }: Pick<Source, 'sponsors' | 'selectedSponsorIds'>): string[] {
  return selectedSponsorIds.map((id) => sponsors.find((sponsor) => sponsor.id === id)?.logoUrl).filter((url): url is string => Boolean(url))
}

// The image generator options for the current choices; `model` is only read for the team logo urls.
export function useMatchImageOptions(source: Source, model: MatchShareModel, specifics: Pick<MatchImageOptions, 'format' | 'size' | 'template' | 'picture' | 'pictureSettings'>): MatchImageOptions {
  const { main, dark, contrastText } = useTheme().palette.primary
  const { choices, clubLogoUrl, leagueLogoUrl, clubWebsite } = source
  const sponsorKey = JSON.stringify(sponsorUrlsOf(source))
  const sponsorUrls = useMemo(() => JSON.parse(sponsorKey) as string[], [sponsorKey])
  const { club, league, team } = choices.logos
  const include = choices.match.include
  const urls = [club ? clubLogoUrl : null, league ? leagueLogoUrl : null, ...sponsorUrls, team ? model.homeLogoUrl : null, team ? model.awayLogoUrl : null].filter((url): url is string => Boolean(url))
  const images = useShareLogoImages(urls)
  const { format, size, template, picture, pictureSettings } = specifics
  return useMemo(
    () => ({
      format,
      size,
      template,
      colour: { main, dark, contrastText },
      include: { marks: include.marks, venueAndDate: include.venueAndDate, weather: include.weather, picture: include.picture },
      logos: { clubUrl: club ? clubLogoUrl : null, leagueUrl: league ? leagueLogoUrl : null, teams: team, sponsorUrls },
      images,
      clubWebsite,
      footerLine: choices.footerLine,
      picture,
      pictureSettings,
    }),
    [format, size, template, main, dark, contrastText, include.marks, include.venueAndDate, include.weather, include.picture, club, league, team, clubLogoUrl, leagueLogoUrl, sponsorUrls, images, clubWebsite, choices.footerLine, picture, pictureSettings],
  )
}

// Draws the image into the preview canvas (debounced) with the SAME generator the file comes from, then reads the canvas back as the
// PNG file, so what is shown is what is shared. `model` and `options` must be memoised by the caller.
export function useMatchImageOutput(model: MatchShareModel, options: MatchImageOptions, fileName: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [made, setMade] = useState<{ input: object; file: File | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useMemo(() => ({ model, options }), [model, options])
  const debounced = useDebouncedValue(input, 150)
  const file = made && made.input === input ? made.file : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    setMade(null)
    try {
      drawMatchImage(canvas, debounced.model, debounced.options)
    } catch {
      setError(MATCH_IMAGE_ERROR)
      return
    }
    canvas.toBlob((blob) => {
      if (cancelled) return
      if (!blob) {
        setError(MATCH_IMAGE_ERROR)
        return
      }
      setError(null)
      setMade({ input: debounced, file: new File([blob], fileName, { type: 'image/png' }) })
    }, 'image/png')
    return () => {
      cancelled = true
    }
  }, [debounced, fileName])

  return { canvasRef, file, error }
}

export function useMatchPdfOptions(source: Source): MatchPdfOptions {
  const { main, dark, contrastText } = useTheme().palette.primary
  const { choices, clubLogoUrl, leagueLogoUrl, clubWebsite } = source
  const sponsorKey = JSON.stringify(sponsorUrlsOf(source))
  const sponsorUrls = useMemo(() => JSON.parse(sponsorKey) as string[], [sponsorKey])
  const { club, league, team } = choices.logos
  const { marks, venueAndDate, weather } = choices.match.include
  return useMemo(
    () => ({
      template: choices.match.templates.pdf,
      colour: { main, dark, contrastText },
      include: { marks, venueAndDate, weather },
      logos: { clubUrl: club ? clubLogoUrl : null, leagueUrl: league ? leagueLogoUrl : null, teams: team, sponsorUrls },
      clubWebsite,
      footerLine: choices.footerLine,
    }),
    [choices.match.templates.pdf, main, dark, contrastText, marks, venueAndDate, weather, club, league, team, clubLogoUrl, leagueLogoUrl, sponsorUrls, clubWebsite, choices.footerLine],
  )
}

// Makes the PDF (debounced) and draws the chosen page of the SAME laid-out document into the preview canvas.
export function useMatchPdfOutput(model: MatchShareModel, options: MatchPdfOptions, fileName: string, pixelWidth?: number) {
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
    generateMatchPdf(debounced.model, debounced.options)
      .then((output) => {
        URL.revokeObjectURL(output.url)
        if (cancelled) return
        setError(null)
        setPages(output.pages)
        setMade({ input: debounced, file: new File([output.blob], fileName, { type: 'application/pdf' }) })
      })
      .catch(() => {
        if (cancelled) return
        setError(MATCH_PDF_ERROR)
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
      if (!cancelled) setError(MATCH_PDF_ERROR)
    })
    return () => {
      cancelled = true
    }
  }, [pages, shown, pixelWidth])

  return { canvasRef, file, pageCount: pages.length, pageIndex: shown, setPageIndex, error }
}
