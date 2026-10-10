import { Box, Stack, Typography } from '@mui/material'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../../../components/Button'
import { DocumentUpload } from '../../../components/DocumentUpload'
import { PlayingConditionsForm } from '../../../components/PlayingConditionsForm'
import { PLAYING_CONDITIONS_PDF_NAME } from '../../../api/leaguePlayingConditionsApi'
import type { PlayingConditionsPayload } from '../../../api/leaguePlayingConditionsApi'

export interface LeagueEditConditionsTabProps {
  hasSeasons: boolean
  selectedSeasonId: string
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

// docs/specs/052-league-playing-conditions.md: the Playing conditions tab of Edit League, the full-document upload plus the
// structured PlayingConditionsForm for the selected season (the season comes from the page's header pill). Keeps today's
// content; restyled in a later step of spec 095.
export function LeagueEditConditionsTab({
  hasSeasons,
  selectedSeasonId,
  document,
  onUpload,
  onUploaded,
  initialValues,
  onSubmit,
  pending,
  error,
  onShare,
}: LeagueEditConditionsTabProps) {
  return (
    <Box sx={{ gridColumn: '1 / -1' }}>
      {!hasSeasons ? (
        <Typography variant="body2" color="text.secondary">
          Create a season first — playing conditions are captured for a league and a specific season.
        </Typography>
      ) : (
        <Stack spacing={4}>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', mb: 1.5 }}
            >
              Full Document
            </Typography>
            <DocumentUpload
              label="Playing Conditions"
              displayName={PLAYING_CONDITIONS_PDF_NAME}
              value={document}
              onUpload={onUpload}
              onUploaded={onUploaded}
            />
          </Box>

          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
              spacing={2}
              sx={{ mb: 1.5 }}
            >
              <Typography
                variant="subtitle2"
                sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}
              >
                Match Format & Points
              </Typography>
              <Button variant="ghost" size="sm" startIcon={<ShareOutlinedIcon fontSize="small" />} onClick={onShare}>
                Share
              </Button>
            </Stack>

            <PlayingConditionsForm
              key={selectedSeasonId}
              initialValues={initialValues}
              onSubmit={onSubmit}
              pending={pending}
              error={error}
            />
          </Box>
        </Stack>
      )}
    </Box>
  )
}
