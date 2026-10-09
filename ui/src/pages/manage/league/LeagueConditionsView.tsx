import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button as MuiButton, Stack, Typography } from '@mui/material'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { InfoCard } from '../../../components/InfoCard'
import { PlayingConditionsShareDialog } from '../../../components/PlayingConditionsShareDialog'
import { getPlayingConditions, PLAYING_CONDITIONS_PDF_NAME } from '../../../api/leaguePlayingConditionsApi'
import { generatePlayingConditionsSummaryPdf } from '../../../utils/playingConditionsSummaryPdf'
import { resolveEffectiveMaxOversPerBowler, resolvePlayingConditionsPayload } from '../../../utils/playingConditions'
import { useLeagueView } from './leagueViewContext'

// docs/specs/072-league-view-pages.md section 5: the Conditions view - the selected season's playing
// conditions rows (unchanged from the old LeagueDetailPage, docs/specs/052), a Share button and,
// when a PDF is stored, a button labelled PLAYING_CONDITIONS_PDF_NAME (never the stored file name).
export default function LeagueConditionsView() {
  const { clubId, leagueId, league, selectedSeasonId, seasonLabel } = useLeagueView()
  const [shareOpen, setShareOpen] = useState(false)

  const playingConditionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'playing-conditions', selectedSeasonId],
    queryFn: () => getPlayingConditions(clubId, leagueId, selectedSeasonId),
    enabled: Boolean(selectedSeasonId),
  })

  // The same "has structured Playing Conditions ever been saved" signal PlayingConditionsForm and
  // LeagueFormPage use (docs/specs/052).
  const payload = resolvePlayingConditionsPayload(playingConditionsQuery.data)
  const documentUrl = playingConditionsQuery.data?.documentUrl ?? null

  const handleSharePdf = async () => {
    if (!payload) {
      return
    }
    const url = await generatePlayingConditionsSummaryPdf(league.name, seasonLabel, payload)
    window.open(url, '_blank', 'noopener')
  }

  const maxOversPerBowler =
    payload && payload.maxOversPerBowler != null
      ? String(payload.maxOversPerBowler)
      : payload
        ? `${resolveEffectiveMaxOversPerBowler(payload.maxOversPerInnings, null)} (auto)`
        : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* The tab's own line: which season these conditions are for, and the PDF and Share actions. */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} useFlexGap flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          {seasonLabel ? `Playing conditions for ${seasonLabel}` : 'Playing conditions'}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {documentUrl && (
            <MuiButton variant="outlined" startIcon={<DescriptionOutlinedIcon fontSize="small" />} onClick={() => window.open(documentUrl, '_blank', 'noopener')}>
              {PLAYING_CONDITIONS_PDF_NAME}
            </MuiButton>
          )}
          <MuiButton variant="outlined" startIcon={<ShareOutlinedIcon fontSize="small" />} onClick={() => setShareOpen(true)}>
            Share
          </MuiButton>
        </Stack>
      </Stack>

      {!payload ? (
        <Typography variant="body2" color="text.secondary">
          No Playing Conditions set for this season yet.
        </Typography>
      ) : (
        <>
          {/* The two top cards stretch to the same height (docs/specs/091). */}
          <Box sx={{ display: 'grid', gap: 2, alignItems: 'stretch', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <InfoCard
              testId="conditions-innings"
              title="Innings"
              icon={<TimerOutlinedIcon />}
              fields={[
                { label: 'Max overs per innings', value: String(payload.maxOversPerInnings) },
                { label: 'Powerplay overs', value: String(payload.powerplayOvers) },
                { label: 'Max overs per bowler', value: maxOversPerBowler },
                { label: 'Substitutions allowed', value: payload.allowSubstitutions ? 'Yes' : 'No' },
              ]}
            />
            <InfoCard
              testId="conditions-points"
              title="Points"
              icon={<EmojiEventsOutlinedIcon />}
              fields={[
                { label: 'Win', value: String(payload.pointsForWin) },
                { label: 'Loss', value: String(payload.pointsForLoss) },
                { label: 'Draw', value: String(payload.pointsForDraw) },
                { label: 'No result', value: String(payload.pointsForNoResult) },
                { label: 'Forfeit win', value: String(payload.pointsForForfeitWin) },
                ...(payload.bonusPointsEnabled
                  ? [
                      { label: 'Bonus — early chase', value: `Before over ${payload.bonusBattingOversThreshold}` },
                      { label: 'Bonus — bowling restriction', value: `${payload.bonusBowlingRestrictionPercentage}% of target` },
                    ]
                  : []),
              ]}
            />
          </Box>
          {payload.fieldingRestrictionsNotes && (
            <InfoCard
              testId="conditions-fielding"
              title="Fielding restrictions"
              icon={<NotesOutlinedIcon />}
              fields={[{ label: 'Notes', value: payload.fieldingRestrictionsNotes }]}
            />
          )}
          {payload.additionalNotes && (
            <InfoCard
              testId="conditions-notes"
              title="Additional notes"
              icon={<StarOutlineOutlinedIcon />}
              fields={[{ label: 'Notes', value: payload.additionalNotes }]}
            />
          )}
        </>
      )}

      <PlayingConditionsShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        hasStructuredFields={Boolean(payload)}
        leagueName={league.name}
        seasonLabel={seasonLabel}
        conditions={payload}
        onSharePdf={handleSharePdf}
      />
    </Box>
  )
}
