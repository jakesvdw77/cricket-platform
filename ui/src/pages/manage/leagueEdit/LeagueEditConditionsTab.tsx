import { Box, Divider, Stack, Typography } from '@mui/material'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../../../components/Button'
import { DocumentUpload } from '../../../components/DocumentUpload'
import { ContentControlsLine } from '../../../components/ContentControlsLine'
import { PlayingConditionsForm, PLAYING_CONDITIONS_FORM_ID } from '../../../components/PlayingConditionsForm'
import { PLAYING_CONDITIONS_PDF_NAME } from '../../../api/leaguePlayingConditionsApi'
import { errorDetail } from '../../../utils/errorDetail'
import type { PlayingConditionsPayload } from '../../../api/leaguePlayingConditionsApi'

export interface LeagueEditConditionsTabProps {
  hasSeasons: boolean
  selectedSeasonId: string
  seasonLabel: string
  // The season's uploaded full document, when there is one.
  document: { documentUrl: string; uploadedAt: string } | null
  onUpload: (file: File) => Promise<string>
  onUploaded: () => void
  initialValues: PlayingConditionsPayload | null
  onSubmit: (payload: PlayingConditionsPayload) => void
  pending: boolean
  error: unknown
  onShare: () => void
}

// docs/specs/052-league-playing-conditions.md, restyled by docs/specs/095: the Playing conditions tab of Edit League for the
// selected season (the season comes from the page's header pill). One content line (which season, the conditions PDF
// upload / view and Share), the sectioned PlayingConditionsForm, and a footer with the error text and the filled Save
// button bound to the form by id.
export function LeagueEditConditionsTab({
  hasSeasons,
  selectedSeasonId,
  seasonLabel,
  document,
  onUpload,
  onUploaded,
  initialValues,
  onSubmit,
  pending,
  error,
  onShare,
}: LeagueEditConditionsTabProps) {
  if (!hasSeasons) {
    return (
      <Box sx={{ gridColumn: '1 / -1' }}>
        <Typography variant="body2" color="text.secondary">
          Create a season first — playing conditions are captured for a league and a specific season.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ContentControlsLine
        scope={seasonLabel ? `Playing conditions for ${seasonLabel}` : 'Playing conditions'}
        pinned={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1 }}>
            <DocumentUpload
              layout="inline"
              label="Playing Conditions"
              displayName={PLAYING_CONDITIONS_PDF_NAME}
              value={document}
              onUpload={onUpload}
              onUploaded={onUploaded}
            />
            <Button variant="secondary" size="sm" startIcon={<ShareOutlinedIcon fontSize="small" />} onClick={onShare}>
              Share
            </Button>
          </Box>
        }
      />

      <PlayingConditionsForm key={selectedSeasonId} initialValues={initialValues} onSubmit={onSubmit} />

      <Divider />
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
        {Boolean(error) && (
          <Typography variant="body2" color="error.main">
            {errorDetail(error, 'Something went wrong saving Playing Conditions. Please try again.')}
          </Typography>
        )}
        <Button type="submit" form={PLAYING_CONDITIONS_FORM_ID} disabled={pending}>
          {pending ? 'Saving…' : 'Save playing conditions'}
        </Button>
      </Stack>
    </Box>
  )
}
