import { useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listGuestNames, resultKeys } from '../../api/matchResultApi'
import { createPlayer, linkPlayerSection, listPlayers } from '../../api/playerApi'
import { listSquad } from '../../api/teamSquadApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { errorDetail } from '../../utils/errorDetail'
import { splitGuestName } from '../../utils/guestNameSplit'
import { PlayerQuickForm } from '../PlayerQuickForm'
import { fullName } from '../../utils/playerDisplayName'
import type { PersonName } from '../../utils/playerDisplayName'
import { alpha } from '@mui/material/styles'
import { BottomSheet } from '../BottomSheet'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { usePlayerLabeler } from '../../hooks/usePlayerLabeler'

export interface PickedPlayer {
  playerProfileId: string
  firstName: string
  lastName: string
}

// docs/specs/104: a ranked closest player for a name an import could not place (score 0 to 1).
export interface PickerSuggestion {
  player: PickedPlayer
  score: number
}

export type PlayerSlotScope = 'match' | 'squad' | 'club' | 'guest' | 'new'

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
  // The players of THIS match for the Match squad scope, already in the order to show: the match selection (with the 12th
  // man) and anyone already on this side's list. Omitted, the picker has no Match squad scope. Empty means no team was
  // selected and nothing is on the list yet: it opens on Team squad with a note.
  matchSquad?: PickedPlayer[]
  // docs/specs/101: pick ONLY from the side's list as defined on Our batting (Our bowling and fielding). Shown instead of the
  // other scopes: `matchPlayers` are all the side's players, `key` identifies each (it is also the key of `takenPlayers` and
  // `hints`), `onPickMatchPlayer` receives the key, and `onNotListed` is the "Add them on Our batting" link.
  matchOnly?: boolean
  // One short explanatory line at the top (what Swap player means).
  note?: string
  matchPlayers?: Array<{ key: string; firstName: string; lastName: string }>
  onPickMatchPlayer?: (key: string) => void
  onNotListed?: () => void
  // The link's text; defaults to "Add them on Teams".
  notListedLabel?: string
  // False when the row can only become a registered player (Link to a registered player...): no Guest scope.
  allowGuest?: boolean
  // docs/specs/104: the name as an imported file wrote it. Shown at the top ("File said: Dino V"), and prefills the
  // Guest name so keeping it as a guest is one tap.
  importedName?: string
  // docs/specs/104: the closest registered players for that name, best first, offered as one-tap picks above the scopes.
  suggestions?: PickerSuggestion[]
  // docs/specs/104: adds a "New player" tab that creates a registered player inside the dialog and picks them in one step
  // (the guest becomes that player). `name` is the guest's written name, split into first name and surname to prefill the
  // form; `sectionId` is the section of the guest's club team, which the new player is linked to. Omitted, no tab.
  newPlayer?: { name: string; sectionId?: string | null }
}

const SCOPE_LABEL: Record<PlayerSlotScope, string> = {
  match: 'Match squad',
  squad: 'Team squad',
  club: 'Club',
  guest: 'Guest',
  new: 'New player',
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

// docs/specs/104: what the file said and, for a name that was not placed, the closest players as one-tap picks.
function ImportedName({
  name,
  suggestions,
  takenPlayers,
  onPick,
}: {
  name: string
  suggestions: PickerSuggestion[]
  takenPlayers: Record<string, string>
  onPick: (player: PickedPlayer) => void
}) {
  const view: PersonName[] = suggestions.map((s) => ({ id: s.player.playerProfileId, firstName: s.player.firstName, lastName: s.player.lastName }))
  const label = usePlayerLabeler(view)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" sx={{ px: 1.25, py: 1, borderRadius: 1, bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12) }}>
        File said: <b>{name}</b>
      </Typography>
      {suggestions.length > 0 && (
        <>
          <Typography variant="caption" component="h3" sx={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Closest players
          </Typography>
          <List disablePadding aria-label="Closest players">
            {suggestions.map(({ player, score }) => {
              const reason = takenPlayers[player.playerProfileId]
              return (
                <ListItemButton
                  key={player.playerProfileId}
                  disabled={Boolean(reason)}
                  onClick={() => !reason && onPick(player)}
                  sx={{ minHeight: 56, borderRadius: 1, border: 1, borderColor: 'divider', mb: 1 }}
                >
                  <ListItemText
                    primary={label({ id: player.playerProfileId, firstName: player.firstName, lastName: player.lastName })}
                    secondary={reason}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  <Chip size="small" label={`${Math.round(score * 100)}%`} aria-label={`${Math.round(score * 100)} percent similar`} sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12), color: 'primary.dark', fontWeight: 600 }} />
                </ListItemButton>
              )
            })}
          </List>
          <Typography variant="caption" color="text.secondary">
            Tapping a name picks that player and remembers it for your club.
          </Typography>
        </>
      )}
    </Box>
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
  allowGuest = true,
  matchSquad,
  matchOnly = false,
  note,
  matchPlayers = [],
  onPickMatchPlayer,
  onNotListed,
  notListedLabel = 'Add them on Teams',
  importedName,
  suggestions = [],
  newPlayer,
}: Omit<PlayerSlotPickerProps, 'open' | 'onClose' | 'title'>) {
  const hasSquad = Boolean(teamId && seasonId)
  const hasMatch = matchSquad !== undefined
  const noSelection = hasMatch && matchSquad.length === 0
  const [scope, setScope] = useState<PlayerSlotScope>(hasMatch && !noSelection ? 'match' : hasSquad ? 'squad' : 'club')
  const [search, setSearch] = useState('')
  const [guest, setGuest] = useState(importedName ?? '')
  const debouncedGuest = useDebouncedValue(guest, 250)
  const queryClient = useQueryClient()
  // Creates the player, tags them to the team's section when one is known (a failure there is not fatal: the player exists
  // and can be tagged from their page), refreshes the club's players so they appear in the Club tab, and picks them.
  const createMutation = useMutation({
    mutationFn: async (values: { firstName: string; lastName: string; dateOfBirth: string }) => {
      const created = await createPlayer(clubId, {
        ...values,
        gender: null,
        photoUrl: null,
        clubMembershipNumber: null,
        medicalAidProvider: null,
        medicalAidMemberNumber: null,
        phone: null,
        email: null,
        altContactName: null,
        altContactPhone: null,
        battingStance: null,
        bowlingArm: null,
        bowlingType: null,
        isWicketKeeper: false,
        jerseyNumber: null,
      })
      if (newPlayer?.sectionId) {
        try {
          await linkPlayerSection(clubId, created.id, newPlayer.sectionId)
        } catch {
          // not fatal
        }
      }
      return created
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'players'] })
      onPickPlayer({ playerProfileId: created.id, firstName: created.firstName, lastName: created.lastName })
    },
  })
  const guessedName = splitGuestName(newPlayer?.name)

  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'],
    queryFn: () => listSquad(clubId, teamId as string, seasonId as string),
    enabled: scope === 'squad' && hasSquad,
  })
  // The club's active players, filtered locally: the roster is a small, bounded list (docs/specs/088), not a page.
  const clubQuery = useQuery({
    queryKey: ['managed-club', clubId, 'players', { includeInactive: false }],
    queryFn: () => listPlayers(clubId, { includeInactive: false }),
    enabled: scope === 'club' || scope === 'guest',
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

  if (matchOnly) {
    const people: PickedPlayer[] = matchPlayers.map((player) => ({ playerProfileId: player.key, firstName: player.firstName, lastName: player.lastName }))
    const needleOnly = norm(search)
    const shown = needleOnly ? people.filter((p) => norm(fullName(p)).includes(needleOnly)) : people
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        {note && (
          <Typography variant="caption" color="text.secondary">
            {note}
          </Typography>
        )}
        <TextField size="small" label="Search players" value={search} onChange={(event) => setSearch(event.target.value)} inputProps={{ 'aria-label': 'Search players' }} autoFocus />
        <Box sx={{ maxHeight: { xs: '50vh', sm: 360 }, overflowY: 'auto' }}>
          <PlayerRows
            people={shown}
            takenPlayers={takenPlayers}
            hints={hints}
            onPick={(player) => onPickMatchPlayer?.(player.playerProfileId)}
            emptyText={needleOnly ? 'No player matches that search.' : 'No players on this side yet.'}
          />
        </Box>
        {onNotListed && (
          <Typography variant="body2" color="text.secondary">
            Not listed?{' '}
            <Button size="small" onClick={onNotListed} sx={{ textTransform: 'none', minHeight: { xs: 44, sm: 0 }, p: 0.5 }}>
              {notListedLabel}
            </Button>
          </Typography>
        )}
      </Box>
    )
  }

  const importedHeader = importedName ? <ImportedName name={importedName} suggestions={suggestions} takenPlayers={takenPlayers} onPick={onPickPlayer} /> : null

  const scopes: PlayerSlotScope[] = [...(hasMatch ? (['match'] as const) : []), ...(hasSquad ? (['squad', 'club'] as const) : (['club'] as const)), ...(allowGuest ? (['guest'] as const) : []), ...(newPlayer ? (['new'] as const) : [])]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      {importedHeader}
      {note && (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      )}
      <CompactToggleGroup<PlayerSlotScope> value={scope} onChange={setScope} ariaLabel="Where to find the player" fullWidth>
        {scopes.map((value) => (
          <ToggleButton key={value} value={value} aria-label={SCOPE_LABEL[value]} sx={{ whiteSpace: 'nowrap' }}>
            {SCOPE_LABEL[value]}
          </ToggleButton>
        ))}
      </CompactToggleGroup>

      {noSelection && scope !== 'guest' && scope !== 'new' && scope !== 'match' && (
        <Typography variant="caption" color="text.secondary">
          No team selected for this match
        </Typography>
      )}

      {scope === 'new' && newPlayer && (
        <PlayerQuickForm
          initialFirstName={guessedName.firstName}
          initialLastName={guessedName.lastName}
          submitLabel="Create and link"
          pending={createMutation.isPending}
          error={createMutation.isError ? errorDetail(createMutation.error, 'The player could not be created. Please try again.') : null}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}

      {scope !== 'guest' && scope !== 'new' && (
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
            {(scope === 'match' ? false : scope === 'squad' ? squadQuery.isError : clubQuery.isError) ? (
              <Alert severity="error">We couldn't load the players.</Alert>
            ) : (scope === 'match' ? false : scope === 'squad' ? squadQuery.isPending : clubQuery.isPending) ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Loading players...
              </Typography>
            ) : (
              <PlayerRows
                people={matching(scope === 'match' ? (matchSquad ?? []) : scope === 'squad' ? squadPeople : clubPeople)}
                takenPlayers={takenPlayers}
                hints={scope === 'match' || scope === 'squad' ? hints : {}}
                onPick={onPickPlayer}
                emptyText={needle ? 'No player matches that search.' : scope === 'match' ? 'No players for this match yet.' : scope === 'squad' ? "This team's squad is empty." : 'No players yet.'}
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
