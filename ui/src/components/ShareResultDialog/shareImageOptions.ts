import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import { generateResultImage } from '../../utils/share/resultImage'
import type { ResultImageLogos, ResultImageOptions } from '../../utils/share/resultImage'
import { shareFileName } from '../../utils/share/shareFileName'
import type { ShareResultModel } from '../../utils/share/shareResultData'
import type { ShareScreenProps } from './shareScreenTypes'
import { useShareLogoImages } from './useShareLogoImages'

type OptionSource = Pick<
  ShareScreenProps,
  'cardModel' | 'choices' | 'sponsors' | 'selectedSponsorIds' | 'clubLogoUrl' | 'leagueLogoUrl' | 'clubWebsite'
>
// What differs per format: the format, size, template and the include switches.
export type ShareImageSpecifics = Omit<ResultImageOptions, 'colour' | 'logos' | 'images' | 'clubWebsite' | 'footerLine'>

function sponsorUrlsOf({ sponsors, selectedSponsorIds }: Pick<OptionSource, 'sponsors' | 'selectedSponsorIds'>): string[] {
  return selectedSponsorIds.map((id) => sponsors.find((sponsor) => sponsor.id === id)?.logoUrl).filter((url): url is string => Boolean(url))
}

// The generator options for the current choices: the club colour from the theme, the logos and footer from the Logos group.
// Memoised on values, so a preview effect depending on it only runs when something really changed.
export function useShareImageOptions(source: OptionSource, specifics: ShareImageSpecifics, enabled = true): ResultImageOptions {
  const { main, dark, contrastText } = useTheme().palette.primary
  const { cardModel, choices, clubLogoUrl, leagueLogoUrl, clubWebsite } = source
  const sponsorUrlsKey = JSON.stringify(sponsorUrlsOf(source))
  const sponsorUrls = useMemo(() => JSON.parse(sponsorUrlsKey) as string[], [sponsorUrlsKey])
  const specificsKey = JSON.stringify(specifics)
  const stableSpecifics = useMemo(() => JSON.parse(specificsKey) as ShareImageSpecifics, [specificsKey])

  const logos = useMemo<ResultImageLogos>(
    () => ({
      clubUrl: choices.logos.club ? clubLogoUrl : null,
      leagueUrl: choices.logos.league ? leagueLogoUrl : null,
      teams: choices.logos.team,
      sponsorUrls,
    }),
    [choices.logos.club, choices.logos.league, choices.logos.team, clubLogoUrl, leagueLogoUrl, sponsorUrls],
  )
  const wanted = [
    logos.clubUrl,
    logos.leagueUrl,
    ...sponsorUrls,
    ...(choices.logos.team ? [cardModel.home.logoUrl, cardModel.away.logoUrl] : []),
  ]
  const images = useShareLogoImages(enabled ? wanted.filter((url): url is string => Boolean(url)) : [])

  return useMemo(
    () => ({
      ...stableSpecifics,
      colour: { main, dark, contrastText },
      logos,
      images,
      clubWebsite,
      footerLine: choices.footerLine,
    }),
    [stableSpecifics, main, dark, contrastText, logos, images, clubWebsite, choices.footerLine],
  )
}

// The SQUARE Club green image attached to the WhatsApp and Facebook texts, with the current First names as initials value and the
// remembered logo and footer choices. Null until generated, while off, or when generation fails (the text still works).
export function useAttachedResultImage(props: ShareScreenProps, enabled: boolean): File | null {
  // The model with the Teams choice in force: with Our team only, no opposition player is named on the attached image either.
  const { model } = props
  const options = useShareImageOptions(
    props,
    {
      format: 'IMAGE',
      size: 'SQUARE',
      template: 'CLUB_GREEN',
      topPerformers: true,
      playerOfTheMatch: true,
      venueAndDate: true,
    },
    enabled,
  )
  // The file with the exact model and options it was made from; only handed out while those are the current ones, so a file made
  // with an old First names as initials value is never shareable while the new one is being generated.
  const [made, setMade] = useState<{ model: ShareResultModel; options: ResultImageOptions; file: File } | null>(null)
  const fileName = shareFileName(model, 'png')

  useEffect(() => {
    setMade(null)
    if (!enabled) return
    let cancelled = false
    try {
      void generateResultImage(model, options)
        .then((blob) => {
          if (!cancelled) setMade({ model, options, file: new File([blob], fileName, { type: 'image/png' }) })
        })
        .catch(() => {
          if (!cancelled) setMade(null)
        })
    } catch {
      setMade(null)
    }
    return () => {
      cancelled = true
    }
  }, [enabled, model, options, fileName])

  return enabled && made && made.model === model && made.options === options ? made.file : null
}
