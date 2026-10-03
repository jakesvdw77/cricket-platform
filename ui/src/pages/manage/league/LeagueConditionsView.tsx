import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Stack, Typography } from '@mui/material'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { DetailFieldRow, DetailFieldGrid } from '../../../components/RecordDetailScreen'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { PlayingConditionsShareDialog } from '../../../components/PlayingConditionsShareDialog'
import { getPlayingConditions, PLAYING_CONDITIONS_PDF_NAME } from '../../../api/leaguePlayingConditionsApi'
import { generatePlayingConditionsSummaryPdf } from '../../../utils/playingConditionsSummaryPdf'
import { resolveEffectiveMaxOversPerBowler, resolvePlayingConditionsPayload } from '../../../utils/playingConditions'
import { CardHeaderRow } from './leagueViewParts'
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

  return (
    <>
      <Card>
        <CardHeaderRow
          title="Playing conditions"
          action={
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {documentUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  startIcon={<DescriptionOutlinedIcon fontSize="small" />}
                  onClick={() => window.open(documentUrl, '_blank', 'noopener')}
                >
                  {PLAYING_CONDITIONS_PDF_NAME}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                startIcon={<ShareOutlinedIcon fontSize="small" />}
                onClick={() => setShareOpen(true)}
              >
                Share
              </Button>
            </Stack>
          }
        />

        {!payload ? (
          <Typography variant="body2" color="text.secondary">
            No Playing Conditions set for this season yet.
          </Typography>
        ) : (
          <DetailFieldGrid>
            <DetailFieldRow icon={<SportsCricketOutlinedIcon />} label="Max overs per innings" value={payload.maxOversPerInnings} />
            <DetailFieldRow icon={<BoltOutlinedIcon />} label="Powerplay overs" value={payload.powerplayOvers} />
            <DetailFieldRow
              icon={<TimerOutlinedIcon />}
              label="Max overs per bowler"
              value={
                payload.maxOversPerBowler != null
                  ? payload.maxOversPerBowler
                  : `${resolveEffectiveMaxOversPerBowler(payload.maxOversPerInnings, null)} (auto)`
              }
            />
            {payload.fieldingRestrictionsNotes && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <DetailFieldRow
                  icon={<NotesOutlinedIcon />}
                  label="Fielding restrictions notes"
                  value={payload.fieldingRestrictionsNotes}
                />
              </Box>
            )}
            <DetailFieldRow
              icon={<SwapHorizOutlinedIcon />}
              label="Substitutions allowed"
              value={payload.allowSubstitutions ? 'Yes' : 'No'}
            />
            <DetailFieldRow icon={<EmojiEventsOutlinedIcon />} label="Points for win" value={payload.pointsForWin} />
            <DetailFieldRow icon={<EmojiEventsOutlinedIcon />} label="Points for loss" value={payload.pointsForLoss} />
            <DetailFieldRow icon={<EmojiEventsOutlinedIcon />} label="Points for draw" value={payload.pointsForDraw} />
            <DetailFieldRow
              icon={<EmojiEventsOutlinedIcon />}
              label="Points for no result"
              value={payload.pointsForNoResult}
            />
            <DetailFieldRow
              icon={<EmojiEventsOutlinedIcon />}
              label="Points for forfeit win"
              value={payload.pointsForForfeitWin}
            />
            {payload.bonusPointsEnabled && (
              <>
                <DetailFieldRow
                  icon={<StarOutlineOutlinedIcon />}
                  label="Bonus — early chase"
                  value={`Before over ${payload.bonusBattingOversThreshold}`}
                />
                <DetailFieldRow
                  icon={<StarOutlineOutlinedIcon />}
                  label="Bonus — bowling restriction"
                  value={`${payload.bonusBowlingRestrictionPercentage}% of target`}
                />
              </>
            )}
            {payload.additionalNotes && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <DetailFieldRow icon={<NotesOutlinedIcon />} label="Additional notes" value={payload.additionalNotes} />
              </Box>
            )}
          </DetailFieldGrid>
        )}
      </Card>

      <PlayingConditionsShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        hasStructuredFields={Boolean(payload)}
        leagueName={league.name}
        seasonLabel={seasonLabel}
        conditions={payload}
        onSharePdf={handleSharePdf}
      />
    </>
  )
}
