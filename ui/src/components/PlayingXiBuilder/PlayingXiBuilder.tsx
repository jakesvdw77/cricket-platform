import { useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { Input } from '../Input'
import { Button } from '../Button'
import type { SquadMember } from '../../api/teamSquadApi'
import type { MatchSidePlayer, PlayingRole } from '../../api/matchSideApi'
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'

export type { PlayingRole }
export type { AvailabilityStatus }

const ROLE_LABEL: Record<PlayingRole, string> = {
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
}

const ROLE_OPTIONS: PlayingRole[] = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER']

// docs/specs/031-jersey-numbers.md: every place a squad member's name is shown is prefixed with
// their per-team-squad number when set (e.g. "#7 J. Smith"), falling back to the plain name when
// unset — display only, no new sort/filter control.
function squadDisplayName(member: SquadMember): string {
  const name = `${member.firstName} ${member.lastName}`
  return member.squadJerseyNumber != null ? `#${member.squadJerseyNumber} ${name}` : name
}

// docs/specs/033-availability-aware-xi-builder.md (revised after live review): both statuses get
// a full-row/option colour tint — red for Unavailable, orange/warning for Unsure — matching the
// common traffic-light convention, not a subtle 12%-opacity tint that's easy to miss. Each also
// keeps a text caption for clarity/accessibility (colour is never the only signal).
function availabilityIndicator(
  status: AvailabilityStatus | undefined,
): { tone: 'error' | 'warning' | null; caption: string | null } {
  if (status === 'UNAVAILABLE') {
    return { tone: 'error', caption: 'Unavailable for this match' }
  }
  if (status === 'UNSURE') {
    return { tone: 'warning', caption: 'Marked Unsure for this match' }
  }
  return { tone: null, caption: null }
}

export interface PlayingXiBuilderProps {
  // The team's own squad for the match's season (listSquad(clubId, teamId, match.seasonId)) —
  // fetched by the page, passed down as plain data.
  squad: SquadMember[]
  // The side's current ordered XI (MatchSideDto.players) — battingOrder ascending. This
  // component sorts defensively rather than trusting caller order.
  xi: MatchSidePlayer[]
  captainPlayerId: string | null
  wicketKeeperPlayerId: string | null
  twelfthManPlayerId: string | null
  // League.maxPlayingXiSize, or 11 for a standalone friendly with no League.
  cap: number
  onAddPlayer: (playerProfileId: string, role: PlayingRole) => void
  onRemovePlayer: (playerProfileId: string) => void
  onChangeRole: (playerProfileId: string, role: PlayingRole) => void
  // The full new batting order for every player currently on the side (a swap of two adjacent
  // ids) — the caller (MatchFormPage) owns the actual reorder API call.
  onReorderPlayers: (playerProfileIds: string[]) => void
  onChangeCaptain: (playerProfileId: string | null) => void
  onChangeWicketKeeper: (playerProfileId: string | null) => void
  onChangeTwelfthMan: (playerProfileId: string | null) => void
  // Disables the "Add player" control while an add mutation is in flight — separate from the
  // cap-reached disable below, both read the same way to the admin (control unavailable).
  isAddPending?: boolean
  // Inline surfacing for the server's PlayerNotInSquadException/PlayingXiCapExceededException/
  // PlayerAgeIneligibleException rejections — an Alert, not a silent failure or toast-only.
  errorMessage?: string | null
  // docs/specs/033-availability-aware-xi-builder.md — this side's current poll responses, keyed by
  // playerProfileId. Absent key = no poll yet for this side, or that squad member hasn't responded
  // — both render no indicator at all. AVAILABLE entries are included but render no visual
  // treatment — the component owns 100% of the display decision, the caller just passes through
  // whatever the server returned. Defaults to an empty Map when the poll/responses queries haven't
  // resolved yet or don't apply — never blocks rendering the rest of the builder.
  availabilityByPlayerId?: Map<string, AvailabilityStatus>
}

// docs/specs/029-league-management.md's genuinely new component: an ordered, role-tagged
// playing-XI editor built against a team's squad. Mobile-first — explicit up/down IconButtons
// for reordering rather than drag-and-drop, which doesn't hold up on a touch viewport at 375px.
// Props are data-and-callback only; every mutation is a callback into the caller (MatchFormPage),
// which owns the real React Query calls, per docs/standards/frontend.md's "server state in the
// page, not the component" convention.
export function PlayingXiBuilder({
  squad,
  xi,
  captainPlayerId,
  wicketKeeperPlayerId,
  twelfthManPlayerId,
  cap,
  onAddPlayer,
  onRemovePlayer,
  onChangeRole,
  onReorderPlayers,
  onChangeCaptain,
  onChangeWicketKeeper,
  onChangeTwelfthMan,
  isAddPending = false,
  errorMessage,
  availabilityByPlayerId = new Map(),
}: PlayingXiBuilderProps) {
  const [addSelection, setAddSelection] = useState<SquadMember | null>(null)
  const [addRole, setAddRole] = useState<PlayingRole>('BATSMAN')

  // Keyed by playerProfileId, not member.id (the TeamSquadMember row's own id) — every join below
  // (xi entries, captain/keeper/twelfth-man ids) is expressed in terms of playerProfileId, per
  // MatchSidePlayer's own shape (docs/specs/029-league-management.md), unchanged by 031's DTO
  // reshape.
  const squadById = useMemo(() => {
    const map = new Map<string, SquadMember>()
    squad.forEach((member) => map.set(member.playerProfileId, member))
    return map
  }, [squad])

  const orderedXi = useMemo(() => [...xi].sort((a, b) => a.battingOrder - b.battingOrder), [xi])
  const xiIds = useMemo(() => new Set(orderedXi.map((entry) => entry.playerProfileId)), [orderedXi])

  const notYetAdded = useMemo(() => squad.filter((member) => !xiIds.has(member.playerProfileId)), [squad, xiIds])

  const atCap = orderedXi.length >= cap

  const handleAdd = () => {
    if (!addSelection || atCap) {
      return
    }
    onAddPlayer(addSelection.playerProfileId, addRole)
    setAddSelection(null)
    setAddRole('BATSMAN')
  }

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= orderedXi.length) {
      return
    }
    const reordered = [...orderedXi.map((entry) => entry.playerProfileId)]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    onReorderPlayers(reordered)
  }

  const captainOptions = orderedXi
    .map((entry) => squadById.get(entry.playerProfileId))
    .filter((member): member is SquadMember => Boolean(member))
  const twelfthManOptions = notYetAdded

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Playing XI
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {orderedXi.length} / {cap}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (orderedXi.length / cap) * 100)}
          sx={{ borderRadius: 1, height: 6 }}
        />
      </Box>

      <Stack spacing={1.5}>
        {orderedXi.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No players added to the batting order yet.
          </Typography>
        )}

        {orderedXi.map((entry, index) => {
          const member = squadById.get(entry.playerProfileId)
          const name = member ? squadDisplayName(member) : entry.playerProfileId
          const isCaptain = captainPlayerId === entry.playerProfileId
          const isKeeper = wicketKeeperPlayerId === entry.playerProfileId
          const indicator = availabilityIndicator(availabilityByPlayerId.get(entry.playerProfileId))

          return (
            <Box
              key={entry.playerProfileId}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: indicator.tone ? (theme) => alpha(theme.palette[indicator.tone as 'error' | 'warning'].main, 0.16) : undefined,
              }}
            >
              <Typography variant="body2" fontWeight={600} sx={{ width: 24, flex: 'none' }}>
                {entry.battingOrder}
              </Typography>

              <Stack direction="column" spacing={0.25} sx={{ flex: '1 1 160px', minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {name}
                  </Typography>
                  {isCaptain && <Chip label="C" size="small" color="primary" />}
                  {isKeeper && <Chip label="WK" size="small" variant="outlined" />}
                </Stack>
                {indicator.caption && (
                  <Typography variant="caption" color={`${indicator.tone}.dark`}>
                    {indicator.caption}
                  </Typography>
                )}
              </Stack>

              <Input
                select
                label="Role"
                size="small"
                value={entry.role}
                onChange={(event) => onChangeRole(entry.playerProfileId, event.target.value as PlayingRole)}
                sx={{ width: 160, flex: 'none' }}
              >
                {ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </MenuItem>
                ))}
              </Input>

              <Stack direction="row" spacing={0.5} sx={{ flex: 'none' }}>
                <IconButton
                  size="small"
                  aria-label={`Move ${name} up`}
                  disabled={index === 0}
                  onClick={() => handleMove(index, -1)}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Move ${name} down`}
                  disabled={index === orderedXi.length - 1}
                  onClick={() => handleMove(index, 1)}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" aria-label={`Remove ${name}`} onClick={() => onRemovePlayer(entry.playerProfileId)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          )
        })}
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
        <Autocomplete<SquadMember>
          options={notYetAdded}
          value={addSelection}
          getOptionLabel={(option) => squadDisplayName(option)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_event, value) => setAddSelection(value)}
          disabled={atCap}
          sx={{ flex: '1 1 220px', minWidth: 200 }}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props
            const indicator = availabilityIndicator(availabilityByPlayerId.get(option.playerProfileId))
            return (
              <Box
                component="li"
                key={key}
                {...optionProps}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  bgcolor: indicator.tone ? (theme) => alpha(theme.palette[indicator.tone as 'error' | 'warning'].main, 0.16) : undefined,
                }}
              >
                <Typography variant="body2">{squadDisplayName(option)}</Typography>
                {indicator.caption && (
                  <Typography variant="caption" color={`${indicator.tone}.dark`}>
                    {indicator.caption}
                  </Typography>
                )}
              </Box>
            )
          }}
          renderInput={(params) => <Input {...params} label="Add player" placeholder="Search squad" />}
        />

        <Input
          select
          label="Role"
          value={addRole}
          onChange={(event) => setAddRole(event.target.value as PlayingRole)}
          sx={{ width: 160, flex: 'none' }}
        >
          {ROLE_OPTIONS.map((role) => (
            <MenuItem key={role} value={role}>
              {ROLE_LABEL[role]}
            </MenuItem>
          ))}
        </Input>

        <Button onClick={handleAdd} disabled={!addSelection || atCap || isAddPending} sx={{ flex: 'none' }}>
          {isAddPending ? 'Adding…' : 'Add player'}
        </Button>
      </Box>

      {atCap && (
        <Typography variant="caption" color="text.secondary">
          The playing XI is full ({cap} players) — remove a player to add another.
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <Input
          select
          label="Captain"
          value={captainPlayerId ?? ''}
          onChange={(event) => onChangeCaptain(event.target.value || null)}
        >
          <MenuItem value="">None</MenuItem>
          {captainOptions.map((member) => (
            <MenuItem key={member.playerProfileId} value={member.playerProfileId}>
              {squadDisplayName(member)}
            </MenuItem>
          ))}
        </Input>

        <Input
          select
          label="Wicketkeeper"
          value={wicketKeeperPlayerId ?? ''}
          onChange={(event) => onChangeWicketKeeper(event.target.value || null)}
        >
          <MenuItem value="">None</MenuItem>
          {captainOptions.map((member) => (
            <MenuItem key={member.playerProfileId} value={member.playerProfileId}>
              {squadDisplayName(member)}
            </MenuItem>
          ))}
        </Input>

        <Input
          select
          label="Twelfth man"
          value={twelfthManPlayerId ?? ''}
          onChange={(event) => onChangeTwelfthMan(event.target.value || null)}
        >
          <MenuItem value="">None</MenuItem>
          {twelfthManOptions.map((member) => {
            const indicator = availabilityIndicator(availabilityByPlayerId.get(member.playerProfileId))
            return (
              <MenuItem
                key={member.playerProfileId}
                value={member.playerProfileId}
                sx={{
                  bgcolor: indicator.tone ? (theme) => alpha(theme.palette[indicator.tone as 'error' | 'warning'].main, 0.16) : undefined,
                }}
              >
                {indicator.caption ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2">{squadDisplayName(member)}</Typography>
                    <Typography variant="caption" color={`${indicator.tone}.dark`}>
                      {indicator.caption}
                    </Typography>
                  </Box>
                ) : (
                  squadDisplayName(member)
                )}
              </MenuItem>
            )
          })}
        </Input>
      </Box>
    </Box>
  )
}
