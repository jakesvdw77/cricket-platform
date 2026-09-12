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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { Input } from '../Input'
import { Button } from '../Button'
import type { Player } from '../../api/playerApi'
import type { MatchSidePlayer, PlayingRole } from '../../api/matchSideApi'

export type { PlayingRole }

const ROLE_LABEL: Record<PlayingRole, string> = {
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
}

const ROLE_OPTIONS: PlayingRole[] = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER']

function fullName(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

export interface PlayingXiBuilderProps {
  // The team's own squad for the match's season (listSquad(clubId, teamId, match.seasonId)) —
  // fetched by the page, passed down as plain data.
  squad: Player[]
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
}: PlayingXiBuilderProps) {
  const [addSelection, setAddSelection] = useState<Player | null>(null)
  const [addRole, setAddRole] = useState<PlayingRole>('BATSMAN')

  const squadById = useMemo(() => {
    const map = new Map<string, Player>()
    squad.forEach((player) => map.set(player.id, player))
    return map
  }, [squad])

  const orderedXi = useMemo(() => [...xi].sort((a, b) => a.battingOrder - b.battingOrder), [xi])
  const xiIds = useMemo(() => new Set(orderedXi.map((entry) => entry.playerProfileId)), [orderedXi])

  const notYetAdded = useMemo(() => squad.filter((player) => !xiIds.has(player.id)), [squad, xiIds])

  const atCap = orderedXi.length >= cap

  const handleAdd = () => {
    if (!addSelection || atCap) {
      return
    }
    onAddPlayer(addSelection.id, addRole)
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
    .filter((player): player is Player => Boolean(player))
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
          const player = squadById.get(entry.playerProfileId)
          const name = player ? fullName(player) : entry.playerProfileId
          const isCaptain = captainPlayerId === entry.playerProfileId
          const isKeeper = wicketKeeperPlayerId === entry.playerProfileId

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
              }}
            >
              <Typography variant="body2" fontWeight={600} sx={{ width: 24, flex: 'none' }}>
                {entry.battingOrder}
              </Typography>

              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: '1 1 160px', minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {name}
                </Typography>
                {isCaptain && <Chip label="C" size="small" color="primary" />}
                {isKeeper && <Chip label="WK" size="small" variant="outlined" />}
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
        <Autocomplete<Player>
          options={notYetAdded}
          value={addSelection}
          getOptionLabel={(option) => fullName(option)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_event, value) => setAddSelection(value)}
          disabled={atCap}
          sx={{ flex: '1 1 220px', minWidth: 200 }}
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
          {captainOptions.map((player) => (
            <MenuItem key={player.id} value={player.id}>
              {fullName(player)}
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
          {captainOptions.map((player) => (
            <MenuItem key={player.id} value={player.id}>
              {fullName(player)}
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
          {twelfthManOptions.map((player) => (
            <MenuItem key={player.id} value={player.id}>
              {fullName(player)}
            </MenuItem>
          ))}
        </Input>
      </Box>
    </Box>
  )
}
