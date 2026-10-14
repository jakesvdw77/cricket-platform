import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, Chip, MenuItem, ListItemIcon, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import AddIcon from '@mui/icons-material/Add'
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined'
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import type { ResultPlayer, Scorecard, ScorecardPrefillSide } from '../../../../api/matchResultApi'
import { listSquad } from '../../../../api/teamSquadApi'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { badgeSx } from '../../../../components/RecordCard'
import { ScorecardGrid } from '../../../../components/ScorecardGrid'
import { useReorderableRows } from '../../../../hooks/useReorderableRows'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { LINEUP_SIZE, playerRowKey, resetToSelection } from '../../../../utils/scorecardPrefill'
import { newRowFill } from '../../../../utils/wicketFill'
import { selectTeamPath } from '../../teamSelection/selectionLinks'
import { regularInningsOf } from '../resultDraftHelpers'
import { ScorecardPlayerCell } from '../scorecard/ScorecardPlayerCell'
import { ScorecardStepHeader } from '../scorecard/ScorecardStepHeader'
import { usePlayerActions } from '../scorecard/usePlayerActions'
import {
  addPlayer,
  battingOf,
  duplicatePlayerKeys,
  ensureSideFromPrefill,
  matchSquadFor,
  playersOfSide,
  playsInMatch,
  reconcileSubstitutes,
  removePlayer,
  scorecardOf,
  setBatting,
  setSubstitute,
  syncInningsFromScorecard,
  withScorecard,
  wicketsOwned,
} from '../scorecardDraft'
import type { ScorecardStepProps } from './stepTypes'

// docs/specs/101-match-results-our-side-scorecard.md, step "Our team" (decision 21): who played is settled once, first.
// Pre-filled from the team selection (the eleven in the announced batting order, the 12th man captioned), with the derby
// Home | Away switch (each side its own list), a name popup per player (Swap, Link on a guest, Mark as 12th man, Remove),
// Add player through the four-tab picker, and the Populate from the team / No team selected states. Our batting, Our
// bowling and fielding and Awards then use only this list.
export function OurTeamStep({
  clubId,
  match,
  draft,
  onReplace,
  disabled,
  oursSides,
  prefill,
  prefillState,
  scorecardSide,
  onScorecardSideChange,
  onGoToStep,
  onSaveAndNavigate,
}: ScorecardStepProps) {
  const ours = oursSides.find((candidate) => candidate.side === scorecardSide) ?? oursSides[0]
  const side = ours.side
  const scorecard = scorecardOf(draft)
  const innings = regularInningsOf(draft).find((item) => item.battingSide === side)
  const wickets = innings && wicketsOwned(innings) ? (innings.wickets ?? null) : null
  const prefillSide = prefill?.sides.find((candidate) => candidate.side === side) ?? null
  const players = playersOfSide(scorecard, side)
  const batting = battingOf(scorecard, side)
  const duplicates = duplicatePlayerKeys(scorecard, side)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [resetOpen, setResetOpen] = useState(false)
  const [populating, setPopulating] = useState(false)
  const [fromSquad, setFromSquad] = useState(false)
  const [populateFailed, setPopulateFailed] = useState(false)

  const selectionSubstitutes = new Set((prefillSide?.players ?? []).filter((candidate) => candidate.substitute).map((candidate) => candidate.playerProfileId))
  const commit = (next: Scorecard) => onReplace(syncInningsFromScorecard(withScorecard(draft, reconcileSubstitutes(next, selectionSubstitutes))))

  // The list as drawn: the team in batting order, then the 12th man and substitutes.
  const order = new Map(batting.map((entry, index) => [entry.resultPlayerId ?? entry.playerClientKey, index]))
  const rank = (player: ResultPlayer) => order.get(playerRowKey(player)) ?? Number.MAX_SAFE_INTEGER
  const team = players.filter((player) => !player.substitute).sort((a, b) => rank(a) - rank(b))
  const substitutes = players.filter((player) => player.substitute)
  const rows = [...team, ...substitutes]
  const ids = team.map(playerRowKey)

  // First open: the list from the team selection (nothing is written until a save).
  useEffect(() => {
    if (players.length > 0 || prefillState !== 'ready') return
    const built = ensureSideFromPrefill(scorecard, prefillSide, wickets)
    if (built) commit(built)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, prefillState, players.length])

  const populate = async () => {
    setPopulateFailed(false)
    const withoutSide = { ...scorecard, players: scorecard.players.filter((player) => player.side !== side) }
    if (prefillSide && prefillSide.players.length > 0) {
      const built = ensureSideFromPrefill(withoutSide, prefillSide, wickets)
      if (built) commit(built)
      setFromSquad(false)
      return
    }
    setPopulating(true)
    try {
      const squad = await queryClient.fetchQuery({
        queryKey: ['managed-club', clubId, 'teams', ours.teamId, 'seasons', match.seasonId, 'squad'],
        queryFn: () => listSquad(clubId, ours.teamId, match.seasonId),
      })
      const sorted = [...squad].sort(
        (a, b) =>
          (a.squadJerseyNumber ?? Number.MAX_SAFE_INTEGER) - (b.squadJerseyNumber ?? Number.MAX_SAFE_INTEGER) ||
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
      )
      const squadSide: ScorecardPrefillSide = {
        side,
        teamId: ours.teamId,
        teamName: ours.teamName,
        players: sorted.slice(0, LINEUP_SIZE).map((member) => ({
          playerProfileId: member.playerProfileId,
          firstName: member.firstName,
          lastName: member.lastName,
          plannedBattingOrder: null,
          role: 'BATSMAN' as const,
          substitute: false,
        })),
      }
      const built = ensureSideFromPrefill(withoutSide, squadSide, wickets)
      if (built) {
        commit(built)
        setFromSquad(true)
      } else setPopulateFailed(true)
    } catch {
      setPopulateFailed(true)
    } finally {
      setPopulating(false)
    }
  }

  const view: PersonName[] = players.map((player) => scorecardPersonName(player))
  const label = usePlayerLabeler(view)
  const plannedPeople = new Map((prefillSide?.players ?? []).map((player) => [player.playerProfileId, player]))

  const onReorder = (nextIds: string[]) => {
    const byId = new Map(batting.map((entry) => [entry.resultPlayerId ?? entry.playerClientKey, entry]))
    commit(setBatting(scorecard, side, nextIds.map((id) => byId.get(id)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))))
  }
  const reorder = useReorderableRows({ ids, onReorder })

  const taken: Record<string, string> = {}
  const takenGuests: string[] = []
  for (const player of players) {
    if (player.substitute) continue
    if (player.playerProfileId) taken[player.playerProfileId] = 'Already on the list'
    else if (player.displayName) takenGuests.push(player.displayName)
  }
  const hints: Record<string, string> = {}
  for (const planned of prefillSide?.players ?? []) if (planned.substitute) hints[planned.playerProfileId] = '12th man'

  const tookPart = (player: ResultPlayer) => playsInMatch(scorecard, player)

  const actions = usePlayerActions({
    clubId,
    seasonId: match.seasonId,
    ours,
    scorecard,
    onScorecard: commit,
    ids,
    positionLabel: 'Batting position',
    view,
    hints,
    onReorder,
    movable: (key) => ids.includes(key),
    positionDisabledReason: (key) => (ids.includes(key) ? null : 'The 12th man is not in the batting order'),
    matchSquad: matchSquadFor(scorecard, side, prefillSide, false),
    removeLabel: 'Remove from the team',
    removeDescription: (name) => `This removes ${name} and all their figures: their batting, bowling and fielding rows and any award are deleted.`,
    onRemove: (key) => commit(removePlayer(scorecard, key)),
    addTitle: 'Add player',
    addTakenPlayers: taken,
    addTakenGuests: takenGuests,
    onAdd: (identity) => commit(addPlayer(scorecard, side, identity, newRowFill(batting, wickets).howOut).scorecard),
    extraItems: (key, close): ReactNode[] => {
      const player = scorecard.players.find((candidate) => playerRowKey(candidate) === key)
      if (!player) return []
      return [
        <MenuItem
          key="substitute"
          disabled={disabled || (!player.substitute && tookPart(player))}
          onClick={() => {
            commit(setSubstitute(scorecard, key, !player.substitute))
            close()
          }}
        >
          <ListItemIcon>
            <PersonOffOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {player.substitute ? 'Move into the team' : 'Mark as 12th man / substitute'}
        </MenuItem>,
      ]
    },
    disabled,
  })

  const captionOf = (player: ResultPlayer): string | null => {
    const parts: string[] = []
    if (player.substitute || (player.playerProfileId && selectionSubstitutes.has(player.playerProfileId))) parts.push('12th man')
    if (player.replacedPlayerProfileId) {
      const replaced = plannedPeople.get(player.replacedPlayerProfileId)
      parts.push(replaced ? `replaced ${label({ id: replaced.playerProfileId, firstName: replaced.firstName, lastName: replaced.lastName })}` : 'swapped in')
    }
    if (player.plannedBattingOrder != null && !player.substitute) parts.push(`planned ${player.plannedBattingOrder}`)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  const took = players.filter((player) => !player.substitute && tookPart(player)).length
  const countLine = `${team.length} ${team.length === 1 ? 'player' : 'players'}${substitutes.length > 0 ? ` + ${substitutes.length === 1 ? '12th man' : `${substitutes.length} substitutes`}` : ''}`
  const empty = rows.length === 0
  const incomplete = Object.fromEntries(oursSides.map((candidate) => [candidate.side, playersOfSide(scorecard, candidate.side).length === 0]))

  const typeChips = (player: ResultPlayer) => (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      <Chip size="small" label={player.playerProfileId ? 'Registered' : 'Guest'} sx={{ ...badgeSx('neutral'), height: { xs: 20, sm: 18 }, fontSize: '0.7rem' }} />
      {duplicates.has(playerRowKey(player)) && (
        <Chip size="small" color="error" variant="outlined" label="Duplicate" sx={{ height: { xs: 20, sm: 18 }, fontSize: '0.7rem' }} />
      )}
    </Box>
  )

  const nameCell = (player: ResultPlayer) => (
    <ScorecardPlayerCell
      person={scorecardPersonName(player)}
      view={view}
      guest={false}
      caption={captionOf(player)}
      onOpen={(anchor) => actions.openMenu(playerRowKey(player), anchor)}
      duplicate={false}
      disabled={disabled}
    />
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <ScorecardStepHeader oursSides={oursSides} scorecardSide={side} onSideChange={onScorecardSideChange} incomplete={incomplete} />
      <FormSectionHeading icon={<GroupsOutlinedIcon />} title={`${ours.teamName}: who played`} />

      {!empty && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {countLine}
          </Typography>
          {prefillSide && prefillSide.players.length > 0 && (
            <Button variant="ghost" size="sm" startIcon={<RestartAltIcon />} onClick={() => setResetOpen(true)} disabled={disabled}>
              Reset to selection
            </Button>
          )}
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">
        {prefillSide && prefillSide.players.length > 0 ? 'From the announced team. ' : ''}
        Swap = the selected player did not play, this person played instead. Add anyone who came on during the match.
      </Typography>
      {took > LINEUP_SIZE && (
        <Alert severity="info" sx={{ py: 0 }}>
          More than eleven players have taken part. If one was replaced, set them to Did not bat on Our batting or move them out of the team.
        </Alert>
      )}

      {empty && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
          <Button variant="secondary" startIcon={<GroupAddOutlinedIcon />} onClick={() => void populate()} disabled={disabled || populating || prefillState === 'loading'}>
            {populating ? 'Loading the team…' : 'Populate from the team'}
          </Button>
          {prefillState === 'ready' && !(prefillSide && prefillSide.players.length > 0) && (
            <Alert
              severity="info"
              sx={{ width: '100%' }}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (onSaveAndNavigate ? onSaveAndNavigate(selectTeamPath(match.id, null, side === 'HOME')) : navigate(selectTeamPath(match.id, null, side === 'HOME')))}
                >
                  Select the team
                </Button>
              }
            >
              No team selected for this match: add players or select the team first. Populate will use the team's squad.
            </Alert>
          )}
          {populateFailed && <Alert severity="warning">The team's squad is empty or could not be loaded. Add players with Add player.</Alert>}
        </Box>
      )}
      {fromSquad && !empty && (
        <Typography variant="body2" color="text.secondary">
          No team selection found: using the squad.
        </Typography>
      )}

      <ScorecardGrid<ResultPlayer>
        ariaLabel={`${ours.teamName} team`}
        playerHeader="Player"
        rows={rows}
        getRowId={playerRowKey}
        columns={[{ id: 'type', header: 'Type', render: typeChips }]}
        renderPlayer={nameCell}
        renderPosition={(player, index) => (player.substitute ? '–' : index + 1)}
        reorder={reorder}
        reorderDisabled={disabled}
        hideHelp
        emptyMessage="No players yet. Populate from the team or add players."
        renderCard={(player, index) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 700, width: 22, flex: 'none' }}>
              {player.substitute ? '–' : index + 1}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>{nameCell(player)}</Box>
            {typeChips(player)}
          </Box>
        )}
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" startIcon={<AddIcon />} onClick={actions.openAdd} disabled={disabled}>
          Add player
        </Button>
        {onGoToStep && (
          <Button variant="ghost" size="sm" onClick={() => onGoToStep('scores')} disabled={disabled}>
            Skip to scores
          </Button>
        )}
      </Box>

      {actions.host}

      <ConfirmDialog
        open={resetOpen}
        title="Reset to selection?"
        description="Adds any selected players who are missing from the list and refreshes the planned order. Players already on the list are kept."
        confirmLabel="Reset"
        onConfirm={() => {
          setResetOpen(false)
          if (!prefillSide) return
          const merged = resetToSelection({ players, batting }, prefillSide)
          commit({
            ...scorecard,
            players: [...scorecard.players.filter((player) => player.side !== side), ...merged.players],
            batting: [...scorecard.batting.filter((entry) => entry.battingSide !== side), ...merged.batting],
          })
        }}
        onClose={() => setResetOpen(false)}
      />
    </Box>
  )
}
