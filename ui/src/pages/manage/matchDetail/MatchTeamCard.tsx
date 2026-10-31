import { Link as RouterLink } from 'react-router-dom'
import { Box, Button as MuiButton, Card as MuiCard, Chip, Stack, Typography } from '@mui/material'
import { compactButtonSx } from '../../../components/Button'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { badgeSx } from '../../../components/RecordCard'
import { SelectionGauge } from '../../../components/SelectionGauge'
import { PlayingXiSummary } from '../../../components/PlayingXiSummary'
import type { SquadMember } from '../../../api/teamSquadApi'
import type { MatchSide } from '../../../api/matchSideApi'
import { announcedBadge } from '../matches/matchCardHelpers'

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
  // The Select Team page of this side (docs/specs/130: a text-only outlined button in the panel's header row).
  selectTo: string
  // Opens the team sheet dialog on this side. Omitted, the panel has no Share Team Sheet button.
  onShare?: () => void
}

// docs/specs/089 (A), revamped by docs/specs/130: one own side on the match page, a FLAT panel (hairline, no shadow) of equal height
// beside its sibling - a solid-green icon-tile heading with Select Team and Share Team Sheet (text-only outlined, compact) in the
// header row, the announced chip, the selection progress and the Playing XI as compact zebra rows (docs/specs/075/076 content).
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
  onShare,
}: MatchTeamCardProps) {
  const players = side?.players ?? []
  const picked = players.length
  const nothingSelected = players.length === 0 && !side?.twelfthManPlayerId
  const announcedChip = announcedBadge(announced, '')

  return (
    <MuiCard
      variant="outlined"
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, minWidth: 0, height: '100%', bgcolor: 'background.paper', boxShadow: 0, borderColor: 'divider', p: { xs: 2, md: 2.5 } }}
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
        {/* docs/specs/130: the team actions sit in the panel's header row on the right, text only (Share carries the share icon). */}
        <Box role="group" aria-label="Team actions" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <MuiButton component={RouterLink} to={selectTo} variant="outlined" sx={compactButtonSx}>
            Select Team
          </MuiButton>
          {onShare && (
            <MuiButton
              variant="outlined"
              onClick={onShare}
              disabled={sidesReady && nothingSelected}
              aria-describedby={sidesReady && nothingSelected ? `${testId}-share-reason` : undefined}
              aria-label={`Share team sheet for ${teamName}`}
              startIcon={<ShareOutlinedIcon fontSize="small" />}
              sx={compactButtonSx}
            >
              Share Team Sheet
            </MuiButton>
          )}
        </Box>
      </Box>
      {onShare && sidesReady && nothingSelected && (
        <Typography id={`${testId}-share-reason`} variant="caption" color="text.secondary" sx={{ mt: -1 }}>
          Select the team first to share the team sheet.
        </Typography>
      )}

      {sidesReady && (
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" fontWeight={700}>
                Playing XI
              </Typography>
              {announcedReady && (
                <Chip
                  size="small"
                  label={announcedChip.label}
                  variant={announcedChip.tone === 'neutral' ? 'outlined' : 'filled'}
                  sx={badgeSx(announcedChip.tone)}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {playingXiSize === null ? `${picked} picked` : `${picked} of ${playingXiSize} picked`}
            </Typography>
          </Box>
          {playingXiSize !== null && <SelectionGauge picked={picked} size={playingXiSize} ariaLabel={`${teamName} selection`} />}
        </Stack>
      )}

      <Box sx={{ minWidth: 0 }}>
        {!sidesReady ? null : nothingSelected ? (
          <Stack spacing={1.25} alignItems="flex-start" sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No players selected yet.
            </Typography>
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
