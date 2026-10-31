import { useQuery } from '@tanstack/react-query'
import { Box, Typography } from '@mui/material'
import { useLocation } from 'react-router-dom'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined'
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined'
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { InfoCard } from '../../../components/InfoCard'
import { getPlayingConditions } from '../../../api/leaguePlayingConditionsApi'
import { describeBallsPerOver, describeFreeHit, resolveEffectiveMaxOversPerBowler, resolvePlayingConditionsPayload } from '../../../utils/playingConditions'
import { LeagueTabMenu } from './LeagueTabMenu'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { useLeagueView } from './leagueViewContext'

// docs/specs/072-league-view-pages.md section 5: the Conditions view - the selected season's playing
// conditions rows (unchanged from the old LeagueDetailPage, docs/specs/052), and one white Edit Conditions link on the tab row
// (Share and the PDF are Manage League options, docs/specs/126).
export default function LeagueConditionsView() {
  const { clubId, leagueId, league, selectedSeasonId, seasonLabel, openShare } = useLeagueView()
  const location = useLocation()

  const playingConditionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'playing-conditions', selectedSeasonId],
    queryFn: () => getPlayingConditions(clubId, leagueId, selectedSeasonId),
    enabled: Boolean(selectedSeasonId),
  })

  // The same "has structured Playing Conditions ever been saved" signal PlayingConditionsForm and
  // LeagueFormPage use (docs/specs/052).
  const payload = resolvePlayingConditionsPayload(playingConditionsQuery.data)

  const maxOversPerBowler =
    payload && payload.maxOversPerBowler != null
      ? String(payload.maxOversPerBowler)
      : payload
        ? `${resolveEffectiveMaxOversPerBowler(payload.maxOversPerInnings, null)} (auto)`
        : null

  const documentUrl = playingConditionsQuery.data?.documentUrl ?? null
  const editConditionsPath = withReturnTo(
    `/manage/fixtures/leagues/${leagueId}/edit?tab=conditions${selectedSeasonId ? `&seasonId=${selectedSeasonId}` : ''}`,
    currentOrigin(location),
    `${league.name} playing conditions`,
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      {/* The tab's one action: a white Manage Playing Conditions menu (docs/standards/page-anatomy.md). */}
      <LeagueTabMenu
        label="Manage Playing Conditions"
        heading="Playing Conditions"
        testId="manage-conditions"
        items={[
          {
            id: 'edit-conditions',
            title: 'Edit Playing Conditions',
            description: 'Overs, points, bonus points and notes for this league and season.',
            icon: <EditOutlinedIcon fontSize="small" />,
            to: editConditionsPath,
          },
          {
            id: 'share-conditions',
            title: 'Share Playing Conditions',
            description: 'The conditions as a PDF, poster or message.',
            icon: <ShareOutlinedIcon fontSize="small" />,
            onClick: () => openShare?.(['CONDITIONS']),
            disabled: !openShare,
          },
          {
            id: 'view-document',
            title: 'View Document',
            description: "Open the season's playing conditions PDF in a new tab.",
            icon: <PictureAsPdfOutlinedIcon fontSize="small" />,
            onClick: () => window.open(documentUrl ?? '', '_blank', 'noopener'),
            disabled: !documentUrl,
            reason: 'No PDF uploaded',
          },
        ]}
      />

      {/* The tab's own line: which season these conditions are for. */}
      <Typography variant="body1" color="text.secondary">
        {seasonLabel ? `Playing conditions for ${seasonLabel}` : 'Playing conditions'}
      </Typography>

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
              fieldSize="large"
              columns={3}
              title="Innings"
              icon={<TimerOutlinedIcon />}
              fields={[
                { label: 'Max overs per innings', value: String(payload.maxOversPerInnings) },
                { label: 'Powerplay overs', value: String(payload.powerplayOvers) },
                { label: 'Max overs per bowler', value: maxOversPerBowler },
                { label: 'Balls per over', value: describeBallsPerOver(payload.maxBallsPerOver) },
                { label: 'Free hit after a no ball', value: describeFreeHit(payload.freeHitOnNoBall) },
                { label: 'Substitutions allowed', value: payload.allowSubstitutions ? 'Yes' : 'No' },
              ]}
            />
            <InfoCard
              testId="conditions-points"
              fieldSize="large"
              columns={3}
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
              fieldSize="large"
              title="Fielding restrictions"
              icon={<NotesOutlinedIcon />}
              fields={[{ label: 'Notes', value: payload.fieldingRestrictionsNotes }]}
            />
          )}
          {payload.additionalNotes && (
            <InfoCard
              testId="conditions-notes"
              fieldSize="large"
              title="Additional notes"
              icon={<StarOutlineOutlinedIcon />}
              fields={[{ label: 'Notes', value: payload.additionalNotes }]}
            />
          )}
        </>
      )}
    </Box>
  )
}
