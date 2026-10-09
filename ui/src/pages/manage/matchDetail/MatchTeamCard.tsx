import { Link as RouterLink } from 'react-router-dom'
import { Box, Button as MuiButton, Card as MuiCard, Chip, Stack, Typography } from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { badgeSx } from '../../../components/RecordCard'
import { CardProgressBar } from '../../../components/CardProgressBar'
import { PlayingXiSummary } from '../../../components/PlayingXiSummary'
import type { SquadMember } from '../../../api/teamSquadApi'
import type { MatchSide } from '../../../api/matchSideApi'
import { announcedBadge, pickedLegend } from '../matches/matchCardHelpers'

export interface MatchTeamCardProps {
  testId: string
  teamName: string
  sideLabel: 'Home' | 'Away'
  side: MatchSide | undefined
  squad: SquadMember[]
  announced: boolean
  announcedReady: boolean
  sidesReady: boolean
  // A league match's limit (a 12th man counts); null for a match with no league (no bar).
  playingXiSize: number | null
  // The Edit page's Playing XI tab for this match.
  selectTo: string
}

// docs/specs/089 (A): one own side on the match page - a solid-green icon-tile heading, the announced chip, the selection
// progress and the Playing XI as compact zebra rows (docs/specs/075/076 content, restyled).
export function MatchTeamCard({
  testId,
  teamName,
  sideLabel,
  side,
  squad,
  announced,
  announcedReady,
  sidesReady,
  playingXiSize,
  selectTo,
}: MatchTeamCardProps) {
  const players = side?.players ?? []
  const picked = players.length
  const nothingSelected = players.length === 0 && !side?.twelfthManPlayerId
  const announcedChip = announcedBadge(announced, '')

  return (
    <MuiCard
      variant="outlined"
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, minWidth: 0, bgcolor: 'background.paper', boxShadow: 2, p: { xs: 2, md: 2.5 } }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            aria-hidden
            sx={{
              width: 32,
              height: 32,
              flex: 'none',
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': { fontSize: 20 },
            }}
          >
            <SportsCricketOutlinedIcon />
          </Box>
          <Typography
            variant="subtitle2"
            component="h2"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, fontSize: '0.9375rem', minWidth: 0, overflowWrap: 'anywhere' }}
          >
            {`${teamName} · ${sideLabel}`}
          </Typography>
        </Box>
        {announcedReady && (
          <Chip
            size="small"
            label={announcedChip.label}
            variant={announcedChip.tone === 'neutral' ? 'outlined' : 'filled'}
            sx={badgeSx(announcedChip.tone)}
          />
        )}
      </Box>

      {sidesReady && (
        <Stack spacing={0.75}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="body2" fontWeight={700}>
              Playing XI
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {playingXiSize === null ? `${picked} picked` : `${picked} of ${playingXiSize} picked`}
            </Typography>
          </Box>
          {playingXiSize !== null && (
            <>
              <CardProgressBar
                value={picked}
                max={playingXiSize}
                ariaLabel={`${teamName} selection`}
                valueText={`${picked} of ${playingXiSize} picked`}
              />
              <Typography variant="caption" color="text.secondary">
                {pickedLegend(picked, playingXiSize)}
              </Typography>
            </>
          )}
        </Stack>
      )}

      <Box sx={{ minWidth: 0 }}>
        {!sidesReady ? null : nothingSelected ? (
          <Stack spacing={1.25} alignItems="flex-start" sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No players selected yet.
            </Typography>
            <MuiButton component={RouterLink} to={selectTo} variant="outlined" size="small" startIcon={<GroupsOutlinedIcon fontSize="small" />}>
              Select team
            </MuiButton>
          </Stack>
        ) : (
          <PlayingXiSummary
            zebra
            squad={squad}
            xi={players}
            captainPlayerId={side?.captainPlayerId ?? null}
            wicketKeeperPlayerId={side?.wicketKeeperPlayerId ?? null}
            twelfthManPlayerId={side?.twelfthManPlayerId ?? null}
          />
        )}
      </Box>
    </MuiCard>
  )
}
