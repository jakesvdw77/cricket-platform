import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { CompactSwitch } from '../CompactSwitch'
import { ShareFormatScreen } from '../ShareFormatScreen'
import { SharePreviewStage } from '../SharePreviewStage'
import { ShareControlGroup, ShareImageActions } from '../ShareCore'
import { AttachedImagePreview } from '../ShareResultDialog/AttachedImagePreview'
import { LeagueLeftOutNote } from './LeagueLeftOutNote'
import type { LeagueScreenProps } from './leagueScreenTypes'
import { useLeaguePosterOutput } from './useLeaguePosterOutput'

// docs/specs/122-league-sharing.md (Format screens, Poster): the square poster for Teams, Schedule and Key dates, drawn by
// the same generator family as the schedule poster. The preview is the PNG that is shared.
export function PosterLeagueScreen(props: LeagueScreenProps) {
  const { model, choices, updateChoices, shareTitle, ticked } = props
  const colour = useTheme().palette.primary.main
  const teamLogos = choices.logos.team
  const { file, error } = useLeaguePosterOutput(model, colour, teamLogos)

  return (
    <ShareFormatScreen
      title="Poster"
      controls={
        <>
        <LeagueLeftOutNote format="POSTER" ticked={ticked} />
        <ShareControlGroup label="Include">
          <CompactSwitch label="Team logos" checked={teamLogos} onChange={(next) => updateChoices({ logos: { team: next } })} />
        </ShareControlGroup>
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
