import { useState } from 'react'
import { Box, Card, CardContent, Chip, Divider, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { badgeSx } from '../../../../components/RecordCard'
import type { RecordCardBadgeTone } from '../../../../components/RecordCard'
import type { PlayerRow } from '../../../../api/playerAvailabilityApi'
import { dateHeading, kickoffText, slotLabel } from '../../playerAvailability/gridHelpers'
import { CoverageBar } from './CoverageBar'
import { slotHint } from './slotCoverage'
import type { SlotCoverage, SlotStatus } from './slotCoverage'

const VISIBLE_CHIPS = 3

type PlayerName = Pick<PlayerRow, 'firstName' | 'lastName'>

interface SlotCoverageCardProps {
  slot: SlotCoverage
  teamName: (teamId: string) => string
  playersById: Map<string, PlayerName>
}

function badgeFor(slot: SlotCoverage): { label: string; tone: RecordCardBadgeTone } {
  const map: Record<SlotStatus, { label: string; tone: RecordCardBadgeTone }> = {
    COVERED: { label: 'Covered', tone: 'active' },
    TIGHT: { label: 'Tight', tone: 'season' },
    SHORT: { label: `Short by ${slot.shortBy}`, tone: 'closed' },
    NO_XI_SIZE: { label: 'No XI size', tone: 'muted' },
    NO_POLL: { label: 'No poll yet', tone: 'noPoll' },
  }
  return map[slot.status]
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

// "A. de Villiers": first initial and family name.
function shortName({ firstName, lastName }: PlayerName): string {
  const initial = firstName.trim().charAt(0)
  return initial ? `${initial}. ${lastName}` : lastName
}

function fullName({ firstName, lastName }: PlayerName): string {
  return `${firstName} ${lastName}`.trim()
}

const num = { fontWeight: 700, fontVariantNumeric: 'tabular-nums' } as const

function Summary({ slot, compact }: { slot: SlotCoverage; compact: boolean }) {
  const assessed = slot.status !== 'NO_POLL' && slot.status !== 'NO_XI_SIZE'
  if (slot.distinctAvailable === 0) {
    return <>Nobody has said they are available yet</>
  }
  const distinct = plural(slot.distinctAvailable, 'distinct player', 'distinct players')
  if (!assessed) {
    return (
      <>
        <Box component="span" sx={num}>
          {slot.distinctAvailable}
        </Box>{' '}
        {distinct} available
      </>
    )
  }
  return (
    <>
      <Box component="span" sx={num}>
        {slot.distinctAvailable}
      </Box>{' '}
      {distinct} {compact ? 'for' : 'available for'}{' '}
      <Box component="span" sx={num}>
        {slot.placesNeeded}
      </Box>{' '}
      {plural(slot.placesNeeded, 'place', 'places')}
    </>
  )
}

function teamRight(team: SlotCoverage['teams'][number], needed: number | null, compact: boolean): string {
  if (!team.hasPoll) {
    return needed !== null ? `No poll yet · ${needed} needed` : 'No poll yet'
  }
  if (needed === null) return `${team.available} available`
  return compact ? `${team.available} · need ${needed}` : `${team.available} available · ${needed} needed`
}

// docs/specs/074-availability-coverage.md section 6: one card per time slot. Read-only, not a
// RecordCard (it is not a record), same surface as RecordCard/PollCard.
export function SlotCoverageCard({ slot, teamName, playersById }: SlotCoverageCardProps) {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('sm'))
  const [expanded, setExpanded] = useState(false)

  const badge = badgeFor(slot)
  const hint = slotHint(slot, teamName, compact)
  const hasHint = slot.status === 'TIGHT' || slot.status === 'SHORT'
  const showChips = hasHint && slot.sharedIds.length > 0
  const teams = [...slot.teams].sort((a, b) => teamName(a.teamId).localeCompare(teamName(b.teamId)))

  const sharedNames = slot.sharedIds.map((id) => {
    const player = playersById.get(id)
    return { id, short: player ? shortName(player) : id, full: player ? fullName(player) : id }
  })
  const visibleChips = expanded ? sharedNames : sharedNames.slice(0, VISIBLE_CHIPS)
  const hiddenCount = sharedNames.length - VISIBLE_CHIPS

  const mutedParts: string[] = []
  if (!showChips && slot.sharedIds.length > 0) {
    mutedParts.push(`${slot.sharedIds.length} shared ${plural(slot.sharedIds.length, 'player', 'players')}`)
  }
  if (slot.distinctUnsure > 0) {
    const unsure = slot.distinctUnsure
    const noun = plural(unsure, 'unsure answer', 'unsure answers')
    if (slot.status === 'SHORT') {
      mutedParts.push(`${unsure} ${noun} could close ${unsure >= slot.shortBy ? 'the' : 'part of the'} gap`)
    } else {
      mutedParts.push(`${unsure} ${noun} (not counted)`)
    }
  }

  return (
    <Card
      data-testid="slot-coverage-card"
      sx={{ bgcolor: 'background.paper', boxShadow: 2, border: 1, borderColor: 'divider', height: '100%' }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, minWidth: 0 }}>
            {`${dateHeading(slot.date)} · ${slotLabel(slot.dayPart)}`}
          </Typography>
          <Chip
            size="small"
            label={badge.label}
            variant={badge.tone === 'noPoll' ? 'outlined' : 'filled'}
            data-tone={badge.tone}
            sx={{ ...badgeSx(badge.tone), flex: 'none' }}
          />
        </Box>

        <Typography variant="body2" data-testid="slot-summary">
          <Summary slot={slot} compact={compact} />
        </Typography>

        {teams.map((team) => {
          // A slot with an unknown XI size shows no needed anywhere, not even for the teams that have one.
          const needed = slot.status === 'NO_XI_SIZE' ? null : team.needed
          return (
          <Box key={team.teamId} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {teamName(team.teamId)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {teamRight(team, needed, compact)}
              </Typography>
            </Box>
            <CoverageBar
              teamName={teamName(team.teamId)}
              available={team.available}
              ownOnly={team.ownOnly}
              shared={team.shared}
              needed={needed}
              hasPoll={team.hasPoll}
            />
          </Box>
          )
        })}

        {hasHint && hint && (
          <Box
            data-testid="slot-hint"
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, borderRadius: 2, bgcolor: 'action.hover', px: 1.25, py: 1 }}
          >
            {slot.status === 'TIGHT' ? (
              <InfoOutlinedIcon fontSize="small" sx={{ mt: '2px' }} />
            ) : (
              <WarningAmberOutlinedIcon fontSize="small" sx={{ mt: '2px' }} />
            )}
            <Typography variant="body2" sx={{ fontSize: 12.5 }}>
              {hint.map((part, index) =>
                part.bold ? (
                  <Box key={index} component="strong">
                    {part.text}
                  </Box>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
            </Typography>
          </Box>
        )}

        {showChips && (
          <Box component="ul" aria-label="Shared players" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, listStyle: 'none', m: 0, p: 0 }}>
            {visibleChips.map((player) => (
              <li key={player.id}>
                <Chip size="small" label={player.short} title={player.full} aria-label={player.full} sx={badgeSx('side')} />
              </li>
            ))}
            {hiddenCount > 0 && (
              <li>
                <Chip
                  size="small"
                  component="button"
                  clickable
                  label={expanded ? 'Show fewer' : `+${hiddenCount}`}
                  aria-expanded={expanded}
                  onClick={() => setExpanded((open) => !open)}
                  sx={badgeSx('side')}
                />
              </li>
            )}
          </Box>
        )}

        {mutedParts.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
            {mutedParts.join(' · ')}
          </Typography>
        )}

        <Divider />
        <Box component="ul" aria-label="Games" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, listStyle: 'none', m: 0, p: 0 }}>
          {slot.games.map((game) => (
            <Box
              key={game.matchId}
              component="li"
              sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 1, fontSize: 13 }}
            >
              <span>{game.label}</span>
              <Typography component="span" variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {kickoffText(game.matchDate)}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
