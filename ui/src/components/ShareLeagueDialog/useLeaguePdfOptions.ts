import { useMemo } from 'react'
import { useTheme } from '@mui/material/styles'
import type { LeaguePdfOptions } from '../../utils/share/leaguePdf'
import type { LeagueScreenProps } from './leagueScreenTypes'

type OptionSource = Pick<
  LeagueScreenProps,
  'choices' | 'sponsors' | 'selectedSponsorIds' | 'clubLogoUrl' | 'leagueLogoUrl' | 'clubWebsite'
>

// The league PDF generator options for the current choices: the club colour from the theme, the logos and footer from the
// Logos group, Results as the result line or scores only. Memoised on values so the preview effect only reruns on a real change.
export function useLeaguePdfOptions(source: OptionSource): LeaguePdfOptions {
  const { main, dark, contrastText } = useTheme().palette.primary
  const { choices, sponsors, selectedSponsorIds, clubLogoUrl, leagueLogoUrl, clubWebsite } = source
  const sponsorUrlsKey = JSON.stringify(
    selectedSponsorIds.map((id) => sponsors.find((sponsor) => sponsor.id === id)?.logoUrl).filter((url): url is string => Boolean(url)),
  )
  const sponsorUrls = useMemo(() => JSON.parse(sponsorUrlsKey) as string[], [sponsorUrlsKey])
  const { club, league, team } = choices.logos
  const { footerLine } = choices
  const { resultLine } = choices.league.include.results

  return useMemo(
    () => ({
      colour: { main, dark, contrastText },
      logos: {
        clubUrl: club ? clubLogoUrl : null,
        leagueUrl: league ? leagueLogoUrl : null,
        teams: team,
        sponsorUrls,
      },
      clubWebsite,
      footerLine,
      resultLine,
    }),
    [main, dark, contrastText, club, league, team, clubLogoUrl, leagueLogoUrl, sponsorUrls, clubWebsite, footerLine, resultLine],
  )
}
