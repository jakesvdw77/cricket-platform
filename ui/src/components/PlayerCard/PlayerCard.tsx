import type { ReactNode } from 'react'
import {
  Avatar,
  Box,
  Card as MuiCard,
  CardActions,
  CardContent,
  Chip,
  Link as MuiLink,
  Stack,
  Typography,
  Button as MuiButton,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { avatarSx, badgeSx } from '../RecordCard'
import type { RecordCardBadge } from '../RecordCard'
import { initialsFromName } from '../../utils/initials'
import { BATTING_STANCE_LABEL, BOWLING_ARM_LABEL, BOWLING_TYPE_LABEL } from '../../utils/playerLabels'
import type { Player } from '../../api/playerApi'

export interface PlayerCardProps {
  player: Player
  // Already resolved client-side by the caller (PlayerList's own sectionNamesFor join) — this
  // component only renders the first name plus a `+N` overflow chip, it never resolves ids itself.
  sectionNames: string[]
  badge?: RecordCardBadge
  viewTo: string
  editTo: string
}

// One icon+label row, omitted entirely by the caller when its value is absent — copied from
// TeamCard.tsx's own IconRow verbatim, except this card's rows have no bold "Label:" prefix (the
// legacy Cricket Legend app's own player card rendered these bare, and 061's spec keeps that).
function IconRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', '& svg': { fontSize: 18 } }}>
        {icon}
      </Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        {text}
      </Typography>
    </Stack>
  )
}

// The bespoke "Detailed" density card for a Player — docs/specs/061-player-card-avatar-redesign.md's
// approved design-canvas mockup. PlayerList.tsx previously rendered a thin RecordCard wrapper
// showing only two generic fields (DOB, membership number); this replaces it with a shape mirroring
// TeamCard.tsx's own bespoke card directly (avatar, stretched-link title, corner chips, icon rows,
// Edit-only footer) — same "bespoke card, shared shell" posture 057 established for TeamCard.
export function PlayerCard({ player, sectionNames, badge, viewTo, editTo }: PlayerCardProps) {
  const name = `${player.firstName} ${player.lastName}`
  const hasCorner = sectionNames.length > 0 || Boolean(badge)

  const battingText = player.battingStance ? `Bat: ${BATTING_STANCE_LABEL[player.battingStance]}` : null

  const bowlingParts = [
    player.bowlingArm ? BOWLING_ARM_LABEL[player.bowlingArm] : null,
    player.bowlingType ? BOWLING_TYPE_LABEL[player.bowlingType] : null,
  ].filter((part): part is string => Boolean(part))
  const bowlingText = bowlingParts.length > 0 ? `Bowl: ${bowlingParts.join(', ')}` : null

  return (
    // height: '100%' + column flex, position: relative + hover halo — same fixes RecordCard.tsx/
    // TeamCard.tsx apply, per the same real user feedback: a row of these cards sits in a CSS grid,
    // and without them the footer trails unequal content instead of pinning to the bottom, and a
    // viewTo card gives no hover affordance beyond the cursor changing.
    <MuiCard
      sx={{
        bgcolor: 'background.paper',
        boxShadow: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
        outline: '1px solid transparent',
        '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: '1 1 auto' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Avatar src={player.photoUrl ?? undefined} variant="circular" sx={avatarSx(56)}>
              {initialsFromName(name)}
            </Avatar>
            <Stack spacing={0.75} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" component="h3" fontWeight={600} noWrap>
                {/* Stretched-link title, same pattern as RecordCard.tsx/TeamCard.tsx: the link
                    stays position: static (default) so its ::after resolves its containing block
                    to MuiCard above, not to itself — see 059's spec for why. */}
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
              {player.jerseyNumber != null && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`#${player.jerseyNumber}`}
                  sx={{ alignSelf: 'flex-start' }}
                />
              )}
            </Stack>
          </Stack>
          {/* Section (+ overflow) and Inactive badges share the top-right corner — same
              "badge plus other top-right elements share the corner" convention TeamCard.tsx
              already established for its own badge/social-links row. position: relative is the
              same stretched-link stacking-order fix that row gets there. */}
          {hasCorner && (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              alignItems="flex-start"
              sx={{ flex: 'none', position: 'relative' }}
            >
              {sectionNames.length > 0 && <Chip size="small" variant="outlined" label={sectionNames[0]} />}
              {sectionNames.length > 1 && (
                <Chip size="small" variant="outlined" label={`+${sectionNames.length - 1}`} />
              )}
              {badge && (
                <Chip
                  size="small"
                  label={badge.label}
                  variant={badge.tone === 'neutral' ? 'outlined' : 'filled'}
                  sx={badgeSx(badge.tone)}
                />
              )}
            </Stack>
          )}
        </Stack>

        <Stack spacing={0.75}>
          {player.phone && <IconRow icon={<PhoneOutlinedIcon />} text={player.phone} />}
          {battingText && <IconRow icon={<SportsCricketOutlinedIcon />} text={battingText} />}
          {bowlingText && <IconRow icon={<SportsCricketOutlinedIcon />} text={bowlingText} />}
        </Stack>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', px: 2, pb: 2, pt: 0, position: 'relative' }}>
        <MuiButton
          component={RouterLink}
          to={editTo}
          variant="text"
          color="inherit"
          size="small"
          startIcon={<EditOutlinedIcon fontSize="small" />}
        >
          Edit
        </MuiButton>
      </CardActions>
    </MuiCard>
  )
}
