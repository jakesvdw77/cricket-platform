import { useMemo } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareImageActions, ShareLogoControls, ShareTextSizeControl } from '../ShareCore'
import { SHARE_TEXT_SCALE } from '../../utils/share/textSize'
import { AttachedImagePreview } from '../ShareResultDialog/AttachedImagePreview'
import { LeagueLeftOutNote } from './LeagueLeftOutNote'
import type { LeagueScreenProps } from './leagueScreenTypes'
import { useLeaguePosterOutput } from './useLeaguePosterOutput'

// docs/specs/122-league-sharing.md (Format screens, Poster): the square poster for Teams, Schedule and Key dates, drawn by
// the same generator family as the schedule poster. The preview is the PNG that is shared.
export function PosterLeagueScreen(props: LeagueScreenProps) {
  const { model, choices, updateChoices, shareTitle, ticked } = props
  const colour = useTheme().palette.primary.main
  const { clubLogoUrl, leagueLogoUrl, leagueAffiliationLogoUrl, sponsors, selectedSponsorIds } = props
  const posterOptions = useMemo(
    () => ({
      teamLogos: choices.logos.team,
      footer: choices.footerLine,
      textScale: SHARE_TEXT_SCALE[choices.textSize],
      logos: {
        clubUrl: choices.logos.club ? clubLogoUrl : null,
        leagueUrl: choices.logos.league ? leagueLogoUrl : null,
        leagueAffiliationUrl: choices.logos.leagueAffiliation ? (leagueAffiliationLogoUrl ?? null) : null,
        sponsorUrls: selectedSponsorIds.map((id) => sponsors.find((sponsor) => sponsor.id === id)?.logoUrl).filter((url): url is string => Boolean(url)),
      },
    }),
    [choices.logos.team, choices.logos.club, choices.logos.league, choices.logos.leagueAffiliation, choices.footerLine, choices.textSize, clubLogoUrl, leagueLogoUrl, leagueAffiliationLogoUrl, sponsors, selectedSponsorIds],
  )
  const { file, error } = useLeaguePosterOutput(model, colour, posterOptions)

  return (
    <ShareFormatScreen
      title="Poster"
      controls={
        <>
        <LeagueLeftOutNote format="POSTER" ticked={ticked} />
        <ShareTextSizeControl choices={choices} updateChoices={updateChoices} />
        <ShareLogoControls {...props} />
        </>
      }
      preview={
        <SharePreviewStage ariaLabel="Poster preview" zoomable baseWidth={420} fitMaxWidth={560} fitAspect={1} caption="Square poster. This is the image you will share.">
          <Box sx={{ width: '100%' }}>
            <AttachedImagePreview file={file} alt={`Poster for ${model.title}`} />
          </Box>
        </SharePreviewStage>
      }
      actions={<ShareImageActions file={file} shareTitle={shareTitle} error={error} />}
    />
  )
}
