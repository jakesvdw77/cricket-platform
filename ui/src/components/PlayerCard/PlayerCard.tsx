import { LogoAvatar } from '../LogoAvatar'
import { Box, Card as MuiCard, CardContent, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import { badgeSx } from '../RecordCard'
import { cardTitleSx } from '../../theme'
import { DetailLine } from '../DetailLine'
import { PlayerActionsMenu } from '../PlayerActionsMenu'
import { Button } from '../Button'
import { playerAvatarSrc } from '../BrandIcon'
import { initialsFromName } from '../../utils/initials'
import { BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'
import { formatDateOfBirth, NOT_ON_FILE } from '../../utils/playerFormat'
import { playerStatusBadge, playerStatusOf } from '../../utils/playerStatus'
import type { PlayerStatusAction } from '../../utils/playerStatus'
import { zebraTint } from '../../utils/zebraTint'
import type { Player } from '../../api/playerApi'

export interface PlayerCardProps {
  player: Player
  // Already resolved client-side by the caller (PlayerList's own sectionNamesFor join) - this component only renders the
  // first name plus a `+N` overflow chip, it never resolves ids itself.
  sectionNames: string[]
  // Already carries returnTo (the list adds it).
  viewTo: string
  // docs/specs/141 (owner): View Stats is used often, so it stays a button on the card (it is also in the kebab); already carries returnTo.
  statsTo: string
  // docs/specs/088: called when the manager picks a change in the Status menu; the caller does the work and the
  // confirmations (usePlayerStatusActions).
  onStatusAction: (action: PlayerStatusAction) => void
}

function bowlingText(player: Player): string {
  const parts = [
    player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : null,
    player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : null,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(', ') : NOT_ON_FILE
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      data-testid="player-detail-row"
      sx={{ p: 1, borderRadius: 0.75, '&:nth-of-type(odd)': { bgcolor: zebraTint } }}
    >
      <DetailLine label={label} value={value} muted={value === NOT_ON_FILE} />
    </Box>
  )
}

// docs/specs/088-players-polls-alignment.md: the Player card on the poll card's layout, with one rule on top - every card
// has the same parts and the same height whatever is on file or what the player's status is: the avatar and a title
// clamped to two lines; one badge row (the status first, then the first section and a +N, or a dashed "No section");
// two games-played chips in the header's corner; five zebra rows (Number, Born, Phone, Bat, Bowl) that show "–" when
// empty; and the same four footer columns, Status,
// Edit, View and Stats (docs/specs/103). Nothing appears or disappears with the status; the Status button's menu offers only the valid changes.
export function PlayerCard({ player, sectionNames, viewTo, statsTo, onStatusAction }: PlayerCardProps) {
  const name = `${player.firstName} ${player.lastName}`
  const status = playerStatusOf(player)
  const badge = playerStatusBadge(status)

  return (
    // height: '100%' + column flex, position: relative + hover halo - the same fixes RecordCard applies, so a row of
    // these cards sits at one height with the footer pinned, and the whole card (the title's stretched link) is clickable.
    <MuiCard
      sx={{
        bgcolor: 'background.paper',
        // flat with a hairline (page-anatomy section 6); the hover lift is its click cue
        boxShadow: 0,
        border: 1,
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
        outline: '1px solid transparent',
        '&:hover': { outlineColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, flex: '1 1 auto' }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
          <LogoAvatar src={playerAvatarSrc(player.photoUrl, player.gender)} variant="circular" size={56} kind="person" keepTile={!player.photoUrl}>
            {initialsFromName(name)}
          </LogoAvatar>
          <Typography
            variant="subtitle1"
            component="h3"
            sx={{
              ...cardTitleSx,
              flex: 1,
              minWidth: 0,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {/* Stretched-link title (docs/specs/059): the link stays position: static so its ::after resolves its
                containing block to the card above. */}
            <MuiLink
              component={RouterLink}
              to={viewTo}
              color="inherit"
              underline="none"
              sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}
            >
              {name}
            </MuiLink>
          </Typography>
          {/* docs/specs/088: games played, top-right of the header. Always present ("0" when none) so the card never
              changes height; the column stretches its two chips to one width, and the minimum width keeps them
              lining up from card to card. Plain text, not buttons. */}
          <Stack
            data-testid="player-games-chips"
            spacing={0.5}
            sx={{ flex: 'none', minWidth: 104, alignItems: 'stretch', position: 'relative' }}
          >
            <Chip
              size="small"
              variant="outlined"
              aria-label={`${player.gamesThisSeason} games this season`}
              label={
                <>
                  <b>{player.gamesThisSeason}</b> this season
                </>
              }
              sx={{ height: 22, fontSize: '0.75rem', '& .MuiChip-label': { px: 1 } }}
            />
            <Chip
              size="small"
              variant="outlined"
              aria-label={`${player.gamesOverall} games overall`}
              label={
                <>
                  <b>{player.gamesOverall}</b> overall
                </>
              }
              sx={{ height: 22, fontSize: '0.75rem', '& .MuiChip-label': { px: 1 } }}
            />
          </Stack>
          {/* ONE kebab (page-anatomy section 6), lifted above the title's stretched link. */}
          <Box sx={{ position: 'relative', flex: 'none' }}>
            <PlayerActionsMenu player={player} onStatusAction={onStatusAction} />
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ minHeight: 24 }}>
          <Chip size="small" label={badge.label} sx={badgeSx(badge.tone)} data-testid="player-status-badge" />
          {sectionNames.length > 0 ? (
            <Chip size="small" variant="outlined" label={sectionNames[0]} />
          ) : (
            <Chip
              size="small"
              variant="outlined"
              label="No section"
              sx={{ color: 'text.secondary', borderStyle: 'dashed', borderColor: 'text.disabled' }}
            />
          )}
          {sectionNames.length > 1 && <Chip size="small" variant="outlined" label={`+${sectionNames.length - 1}`} />}
        </Stack>

        {/* The same five rows on every card; the margin lets the zebra tint bleed to the card padding's edge. */}
        <Stack sx={{ mx: -1 }}>
          <DetailRow
            label="Number"
            value={player.jerseyNumber != null ? `#${player.jerseyNumber}` : NOT_ON_FILE}
          />
          <DetailRow
            label="Born"
            value={formatDateOfBirth(player.dateOfBirth)}
          />
          <DetailRow label="Phone" value={player.phone || NOT_ON_FILE} />
          <DetailRow
            label="Bat"
            value={player.battingStance ? BATTING_STANCE_LABEL[player.battingStance] : NOT_ON_FILE}
          />
          <DetailRow label="Bowl" value={bowlingText(player)} />
        </Stack>
      </CardContent>

      <PlayerQuickActions status={status} statsTo={statsTo} onVerify={() => onStatusAction('verify')} />
    </MuiCard>
  )
}

// docs/specs/141: the card's frequent actions sit in one row at the foot, lifted above the title's stretched link: View Stats always, and Verify Player first on an
// unverified player (as Announce Team does on a ready side). The row is always there, so every card keeps the same height.
function PlayerQuickActions({ status, statsTo, onVerify }: { status: string; statsTo: string; onVerify: () => void }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, minHeight: 32, px: 2, pb: 1.5, position: 'relative' }}>
      {status === 'unverified' && (
        <Button size="compact" onClick={onVerify}>
          Verify Player
        </Button>
      )}
      <Button size="compact" variant="secondary" startIcon={<EqualizerOutlinedIcon />} onClick={() => navigate(statsTo)} data-testid="player-card-stats">
        View Stats
      </Button>
    </Box>
  )
}
