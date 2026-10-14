import { useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  ToggleButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useQuery } from '@tanstack/react-query'
import { listGuestNames, resultKeys } from '../../api/matchResultApi'
import { listPlayers } from '../../api/playerApi'
import { listSquad } from '../../api/teamSquadApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { fullName } from '../../utils/playerDisplayName'
import type { PersonName } from '../../utils/playerDisplayName'
import { BottomSheet } from '../BottomSheet'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { usePlayerLabeler } from '../../hooks/usePlayerLabeler'

export interface PickedPlayer {
  playerProfileId: string
  firstName: string
  lastName: string
}

export type PlayerSlotScope = 'squad' | 'club' | 'guest'

export interface PlayerSlotPickerProps {
  open: boolean
  onClose: () => void
  clubId: string
  // The side's team and the match's season, for the squad scope. Without both, the picker opens on Anyone in the club.
  teamId: string | null
  seasonId: string | null
  // "Add player", "Swap player".
  title?: string
  // Registered players already on the list, with the reason each cannot be chosen again ("Already batting at 3").
  takenPlayers?: Record<string, string>
  // Guest names already on this side (compared without regard to case): a second identical guest is refused.
  takenGuests?: string[]
  // Squad members to list first, with the word shown under each ("12th man", "Not selected").
  hints?: Record<string, string>
  onPickPlayer: (player: PickedPlayer) => void
  onPickGuest: (displayName: string) => void
}

const SCOPE_LABEL: Record<PlayerSlotScope, string> = {
  squad: "This team's squad",
  club: 'Anyone in the club',
  guest: 'Guest (name only)',
}

const norm = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()

function PlayerRows({
  people,
  takenPlayers,
  hints,
  onPick,
  emptyText,
}: {
  people: PickedPlayer[]
  takenPlayers: Record<string, string>
  hints: Record<string, string>
  onPick: (player: PickedPlayer) => void
  emptyText: string
}) {
  const view: PersonName[] = people.map((p) => ({ id: p.playerProfileId, firstName: p.firstName, lastName: p.lastName }))
  const label = usePlayerLabeler(view)
  if (people.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        {emptyText}
      </Typography>
    )
  }
  return (
    <List disablePadding aria-label="Players">
      {people.map((player, index) => {
        const reason = takenPlayers[player.playerProfileId]
        const secondary = reason ?? hints[player.playerProfileId]
        return (
          <ListItemButton
            key={player.playerProfileId}
            disabled={Boolean(reason)}
            onClick={() => !reason && onPick(player)}
            sx={{ minHeight: 48, borderRadius: 1, bgcolor: index % 2 === 1 ? 'action.hover' : undefined }}
          >
            <ListItemText
              primary={label({ id: player.playerProfileId, firstName: player.firstName, lastName: player.lastName })}
              secondary={secondary}
              primaryTypographyProps={{ fontWeight: 600 }}
              secondaryTypographyProps={{ sx: reason ? { color: 'text.secondary' } : undefined }}
            />
          </ListItemButton>
        )
      })}
    </List>
  )
}

function PickerBody({
  clubId,
  teamId,
  seasonId,
  takenPlayers = {},
  takenGuests = [],
  hints = {},
  onPickPlayer,
  onPickGuest,
}: Omit<PlayerSlotPickerProps, 'open' | 'onClose' | 'title'>) {
  const hasSquad = Boolean(teamId && seasonId)
  const [scope, setScope] = useState<PlayerSlotScope>(hasSquad ? 'squad' : 'club')
  const [search, setSearch] = useState('')
  const [guest, setGuest] = useState('')
  const debouncedGuest = useDebouncedValue(guest, 250)

  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'],
    queryFn: () => listSquad(clubId, teamId as string, seasonId as string),
    enabled: scope === 'squad' && hasSquad,
  })
  // The club's active players, filtered locally: the roster is a small, bounded list (docs/specs/088), not a page.
  const clubQuery = useQuery({
    queryKey: ['managed-club', clubId, 'players', { includeInactive: false }],
    queryFn: () => listPlayers(clubId, { includeInactive: false }),
    enabled: scope !== 'squad',
  })
  const guestQuery = useQuery({
    queryKey: resultKeys.guestNames(clubId, { teamId: teamId ?? undefined, q: debouncedGuest || undefined }),
    queryFn: () => listGuestNames(clubId, { teamId: teamId ?? undefined, q: debouncedGuest || undefined, size: 8 }),
    enabled: scope === 'guest',
  })

  const squadPeople = useMemo<PickedPlayer[]>(() => {
    const members = (squadQuery.data ?? []).map((m) => ({ playerProfileId: m.playerProfileId, firstName: m.firstName, lastName: m.lastName }))
    // The 12th man and the unselected first (they are the likely swaps), then the rest, each group A to Z.
    const rank = (p: PickedPlayer) => (hints[p.playerProfileId] ? 0 : 1)
    return members.sort((a, b) => rank(a) - rank(b) || fullName(a).localeCompare(fullName(b)))
  }, [squadQuery.data, hints])

  const clubPeople = useMemo<PickedPlayer[]>(
    () =>
      (clubQuery.data ?? [])
        .map((p) => ({ playerProfileId: p.id, firstName: p.firstName, lastName: p.lastName }))
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [clubQuery.data],
  )

  const needle = norm(search)
  const matching = (people: PickedPlayer[]) => (needle ? people.filter((p) => norm(fullName(p)).includes(needle)) : people)

  const guestName = guest.trim().replace(/\s+/g, ' ')
  const guestTaken = guestName !== '' && takenGuests.some((name) => norm(name) === norm(guestName))
  const registeredMatch = guestName === '' ? undefined : clubPeople.find((p) => norm(fullName(p)) === norm(guestName))
  const registeredTaken = registeredMatch ? takenPlayers[registeredMatch.playerProfileId] : undefined

  const scopes: PlayerSlotScope[] = hasSquad ? ['squad', 'club', 'guest'] : ['club', 'guest']

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <CompactToggleGroup<PlayerSlotScope> value={scope} onChange={setScope} ariaLabel="Where to find the player" fullWidth>
        {scopes.map((value) => (
          <ToggleButton key={value} value={value} aria-label={SCOPE_LABEL[value]} sx={{ whiteSpace: 'normal', lineHeight: 1.2 }}>
            {SCOPE_LABEL[value]}
          </ToggleButton>
        ))}
      </CompactToggleGroup>

      {scope !== 'guest' && (
        <>
          <TextField
            size="small"
            label="Search players"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            inputProps={{ 'aria-label': 'Search players' }}
            autoFocus
          />
          <Box sx={{ maxHeight: { xs: '50vh', sm: 360 }, overflowY: 'auto' }}>
            {(scope === 'squad' ? squadQuery.isError : clubQuery.isError) ? (
              <Alert severity="error">We couldn't load the players.</Alert>
            ) : (scope === 'squad' ? squadQuery.isPending : clubQuery.isPending) ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Loading players...
              </Typography>
            ) : (
              <PlayerRows
                people={matching(scope === 'squad' ? squadPeople : clubPeople)}
                takenPlayers={takenPlayers}
                hints={scope === 'squad' ? hints : {}}
                onPick={onPickPlayer}
                emptyText={needle ? 'No player matches that search.' : scope === 'squad' ? "This team's squad is empty." : 'No players yet.'}
              />
            )}
          </Box>
        </>
      )}

      {scope === 'guest' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Autocomplete
            freeSolo
            options={(guestQuery.data?.content ?? []).map((g) => g.displayName)}
            inputValue={guest}
            onInputChange={(_event, value) => setGuest(value)}
            filterOptions={(options) => options}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Guest name"
                autoFocus
                error={guestTaken}
                helperText={guestTaken ? 'A guest with this name is already on this list.' : 'A name only; no player is created.'}
                inputProps={{ ...params.inputProps, 'aria-label': 'Guest name' }}
              />
            )}
          />
          {registeredMatch && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" disabled={Boolean(registeredTaken)} onClick={() => onPickPlayer(registeredMatch)}>
                  Use this player
                </Button>
              }
            >
              {registeredTaken
                ? `${fullName(registeredMatch)} is a registered player. ${registeredTaken}`
                : `${fullName(registeredMatch)} is a registered player in this club.`}
            </Alert>
          )}
          <Button
            variant="contained"
            disabled={guestName === '' || guestTaken}
            onClick={() => onPickGuest(guestName)}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            Add as guest
          </Button>
        </Box>
      )}
    </Box>
  )
}

// docs/specs/101-match-results-our-side-scorecard.md (PlayerSlotPicker): choose who a scorecard row is, for adding a
// player and for Swap player... A searchable list with three scopes: This team's squad (default; the 12th man and the
// unselected first), Anyone in the club (the loaded roster filtered here), and Guest (name only) with the club's previous
// guest names as suggestions and a "Use this player" offer when the typed name is a registered player's. Players already
// on the list stay visible but disabled, with the reason. A Dialog from sm, a BottomSheet on a phone. Nothing is created:
// a guest is a name on a row.
export function PlayerSlotPicker({ open, onClose, title = 'Choose a player', ...body }: PlayerSlotPickerProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })

  if (phone) {
    return (
      <BottomSheet open={open} onOpen={() => {}} onClose={onClose} ariaLabel={title} title={title} closeLabel="Close">
        {open && <PickerBody {...body} />}
      </BottomSheet>
    )
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="player-slot-picker-title">
      <DialogTitle id="player-slot-picker-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        {title}
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 0.5 }}>
          <PickerBody {...body} />
        </Box>
      </DialogContent>
    </Dialog>
  )
}
