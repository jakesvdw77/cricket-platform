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
import { NotSelectedBanner } from '../scorecard/NotSelectedBanner'
import { OppositionTeamList } from '../scorecard/OppositionTeamList'
import { ImportGuessBanner } from '../import/ImportGuessBanner'
import { confirmRuleBased } from '../import/guessSummary'
import { ScorecardPlayerCell } from '../scorecard/ScorecardPlayerCell'
import { ScorecardStepHeader } from '../scorecard/ScorecardStepHeader'
import { useGuessActions } from '../scorecard/useGuessActions'
import { usePlayerActions } from '../scorecard/usePlayerActions'
import {
  addPlayer,
  battingOf,
  duplicatePlayerKeys,
  emptyScorecard,
  ensureSideFromPrefill,
  hasBowlingFigures,
  hasCredit,
  matchSquadFor,
  ourTeamNotice,
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
import type { OurSide, ScorecardStepProps } from './stepTypes'

// docs/specs/101-match-results-our-side-scorecard.md, step "Teams" (decisions 21 and 22): who is playing, settled first and
// optional. The side toggle (the Who-won tiles) picks the side. An ours side is pre-filled from the team selection (the
// eleven in the announced batting order, the 12th man captioned) with a name popup per player (Swap, Link on a guest, Mark as
// 12th man, Remove), Add player through the four-tab picker, and the Populate from the team / not-selected notice. The
// opposition is names only (type or paste one per line). The step saves as a draft before the game: a list with no
// innings and no outcome is a real draft. Batting, Bowling and Awards then work from these lists.
export function TeamsStep(props: ScorecardStepProps) {
  const { draft, disabled, oursSides, scorecardSide, onScorecardSideChange, sides, onGoToStep, onReplace } = props
  const side = scorecardSide
  const ours = oursSides.find((candidate) => candidate.side === side) ?? null
  const scorecard = scorecardOf(draft)
  const opposing = sides.find((candidate) => candidate.side === side)
  const incomplete = Object.fromEntries(sides.map((candidate) => [candidate.side, playersOfSide(scorecard, candidate.side).length === 0]))

  // Don't capture the team: the lists that were only proposed (nothing else entered) are dropped, and the wizard moves on.
  const skip = () => {
    const touched =
      scorecard.batting.some((entry) => entry.howOut != null && entry.howOut !== 'DID_NOT_BAT') ||
      scorecard.bowling.some(hasBowlingFigures) ||
      scorecard.fielding.some(hasCredit) ||
      scorecard.awards.length > 0
    if (!touched) {
      const cleared = withScorecard(draft, emptyScorecard())
      onReplace(cleared)
      onGoToStep?.('toss', undefined, cleared)
    } else onGoToStep?.('toss')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <ImportGuessBanner
        players={scorecard.players}
        scorecardSide={side}
        onScorecardSideChange={onScorecardSideChange}
        onConfirmAll={() => onReplace(withScorecard(draft, { ...scorecard, players: confirmRuleBased(scorecard.players) }))}
        disabled={disabled}
      />
      <ScorecardStepHeader sides={sides} scorecardSide={side} onSideChange={onScorecardSideChange} incomplete={incomplete} label="Who is playing?" />
      <FormSectionHeading icon={<GroupsOutlinedIcon />} title={`${ours?.teamName ?? opposing?.name ?? ''}: who played`} />
      {ours ? (
        <OurSideTeam {...props} ours={ours} />
      ) : (
        <OppositionSideTeam {...props} teamName={opposing?.name ?? 'the opposition'} />
      )}
      {onGoToStep && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" onClick={skip} disabled={disabled}>
            Don&apos;t capture the team
          </Button>
        </Box>
      )}
    </Box>
  )
}

function OppositionSideTeam({ clubId, match, draft, onReplace, disabled, scorecardSide, teamName }: ScorecardStepProps & { teamName: string }) {
  const scorecard = scorecardOf(draft)
  const innings = regularInningsOf(draft).find((item) => item.battingSide === scorecardSide)
  const wickets = innings && wicketsOwned(innings) ? (innings.wickets ?? null) : null
  return (
    <OppositionTeamList
      clubId={clubId}
      matchId={match.id}
      seasonId={match.seasonId}
      side={scorecardSide}
      teamName={teamName}
      scorecard={scorecard}
      wickets={wickets}
      commit={(next) => onReplace(syncInningsFromScorecard(withScorecard(draft, next)))}
      disabled={disabled}
    />
  )
}

function OurSideTeam({
  clubId,
  match,
  draft,
  onReplace,
  disabled,
  prefill,
  prefillState,
  onSaveAndNavigate,
  oursSides,
  ours,
}: ScorecardStepProps & { ours: OurSide }) {
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

  const selectTeam = () => {
    const to = selectTeamPath(match.id, null, side === 'HOME')
    if (onSaveAndNavigate) onSaveAndNavigate(to)
    else navigate(to)
  }

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
  // docs/specs/104: the Guess chips of an imported draft (nothing for any other result).
  const guesses = useGuessActions({ clubId, seasonId: match.seasonId, oursSides, prefill, scorecard, onScorecard: commit })
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
  const notice = ourTeamNotice(prefillSide, scorecard, side, prefillState === 'ready')

  const typeChips = (player: ResultPlayer) => (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      <Chip size="small" label={player.playerProfileId ? 'Registered' : 'Guest'} sx={{ ...badgeSx('neutral'), height: { xs: 20, sm: 18 }, fontSize: '0.75rem' }} />
      {duplicates.has(playerRowKey(player)) && (
        <Chip size="small" color="error" variant="outlined" label="Duplicate" sx={{ height: { xs: 20, sm: 18 }, fontSize: '0.75rem' }} />
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
      guess={guesses.guessOf(player)}
    />
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {notice && <NotSelectedBanner notice={notice} onPopulate={empty ? () => void populate() : undefined} populating={populating} onSelectTeam={selectTeam} disabled={disabled} />}

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
        {prefillSide && prefillSide.players.length > 0 ? (prefillSide.selectionState === 'NOT_ANNOUNCED' ? 'From the proposed team. ' : 'From the announced team. ') : ''}
        Swap = the selected player did not play, this person played instead. Add anyone who came on during the match.
      </Typography>
      {took > LINEUP_SIZE && (
        <Alert severity="info" sx={{ py: 0 }}>
          More than eleven players have taken part. If one was replaced, set them to Did not bat on Batting or move them out of the team.
        </Alert>
      )}

      {empty && !notice && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
          <Button variant="secondary" startIcon={<GroupAddOutlinedIcon />} onClick={() => void populate()} disabled={disabled || populating || prefillState === 'loading'}>
            {populating ? 'Loading the team…' : 'Populate from the team'}
          </Button>
        </Box>
      )}
      {empty && populateFailed && <Alert severity="warning">The team&apos;s squad is empty or could not be loaded. Add players with Add player.</Alert>}
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
        isRowFlagged={(player) => guesses.guessOf(player) !== undefined}
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
      </Box>

      {actions.host}
      {guesses.host}

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
