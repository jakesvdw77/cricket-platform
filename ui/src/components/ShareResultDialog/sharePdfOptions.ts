import { useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import type { ResultPdfOptions } from '../../utils/share/resultPdf'
import type { ShareScreenProps } from './shareScreenTypes'

type OptionSource = Pick<
  ShareScreenProps,
  'choices' | 'sponsors' | 'selectedSponsorIds' | 'clubLogoUrl' | 'leagueLogoUrl' | 'clubWebsite'
>

// The generator options for the current PDF choices: the club colour from the theme, the logos and footer from the Logos
// group. Memoised on values, so the preview effect depending on it only runs when something really changed.
export function useSharePdfOptions(source: OptionSource): ResultPdfOptions {
  const { main, dark, contrastText } = useTheme().palette.primary
  const { choices, sponsors, selectedSponsorIds, clubLogoUrl, leagueLogoUrl, clubWebsite } = source
  const sponsorUrlsKey = JSON.stringify(
    selectedSponsorIds.map((id) => sponsors.find((sponsor) => sponsor.id === id)?.logoUrl).filter((url): url is string => Boolean(url)),
  )
  const sponsorUrls = useMemo(() => JSON.parse(sponsorUrlsKey) as string[], [sponsorUrlsKey])
  const include = choices.include.pdf
  const template = choices.templates.pdf

  return useMemo(
    () => ({
      template,
      colour: { main, dark, contrastText },
      include: {
        batting: include.batting,
        bowling: include.bowling,
        extras: include.extras,
        toss: include.toss,
        playerOfTheMatch: include.playerOfTheMatch,
      },
      logos: {
        clubUrl: choices.logos.club ? clubLogoUrl : null,
        leagueUrl: choices.logos.league ? leagueLogoUrl : null,
        teams: choices.logos.team,
        sponsorUrls,
      },
      clubWebsite,
      footerLine: choices.footerLine,
    }),
    [
      template,
      main,
      dark,
      contrastText,
      include.batting,
      include.bowling,
      include.extras,
      include.toss,
      include.playerOfTheMatch,
      choices.logos.club,
      choices.logos.league,
      choices.logos.team,
      clubLogoUrl,
      leagueLogoUrl,
      sponsorUrls,
      clubWebsite,
      choices.footerLine,
    ],
  )
}
