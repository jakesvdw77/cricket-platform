import { useEffect, useState } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined'
import AddIcon from '@mui/icons-material/Add'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import type { BattingEntry, Scorecard, ScorecardPrefillSide } from '../../../../api/matchResultApi'
import { listSquad } from '../../../../api/teamSquadApi'
import { selectTeamPath } from '../../teamSelection/selectionLinks'
import { LINEUP_SIZE } from '../../../../utils/scorecardPrefill'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { ExtrasFields } from '../../../../components/ExtrasFields'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { HowOutSelect } from '../../../../components/HowOutSelect'
import { ReconcileStrip } from '../../../../components/ReconcileStrip'
import { GridNumberInput, ScorecardGrid } from '../../../../components/ScorecardGrid'
import type { ScorecardGridColumn } from '../../../../components/ScorecardGrid'
import { StandoutToggle } from '../../../../components/StandoutToggle'
import { useReorderableRows } from '../../../../hooks/useReorderableRows'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { canFeatureBatter } from '../../../../utils/standout'
import { battingTotals } from '../../../../utils/battingTotals'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { entryPlayerKey, resetToSelection } from '../../../../utils/scorecardPrefill'
import { dismissalCount, applyWicketFill, newRowFill } from '../../../../utils/wicketFill'
import { regularInningsOf, updateInnings } from '../resultDraftHelpers'
import { InningsSummaryCard } from '../scorecard/InningsSummaryCard'
import { ScorecardPlayerCell } from '../scorecard/ScorecardPlayerCell'
import { ScorecardStepHeader } from '../scorecard/ScorecardStepHeader'
import { usePlayerActions } from '../scorecard/usePlayerActions'
import {
  addPlayer,
  duplicatePlayerKeys,
  battingOf,
  ensureSideFromPrefill,
  patchBatting,
  playersByKey,
  playersOfSide,
  removePlayer,
  scorecardOf,
  setBatting,
  stepIncomplete,
  withScorecard,
} from '../scorecardDraft'
import type { ScorecardStepProps } from './stepTypes'

const sameFill = (a: BattingEntry[], b: BattingEntry[]) => a.every((entry, index) => entry.howOut === b[index].howOut && entry.auto === b[index].auto)

// docs/specs/101-match-results-our-side-scorecard.md, step "Our batting": our side's batters in the order they batted,
// pre-filled from the team selection (built here, written only by a save), driven by the wickets from the Scores step
// (once the dismissals equal the wickets the rest become Not out), with the keyboard-first grid, a card per batter on a
// phone, the totals strip and the extras. Reorder by drag handle or the name popup; Swap, Link and Remove live in the
// popup.
export function OurBattingStep({
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
  onSaveAndNavigate,
}: ScorecardStepProps) {
  const ours = oursSides.find((candidate) => candidate.side === scorecardSide) ?? oursSides[0]
  const side = ours.side
  const scorecard = scorecardOf(draft)
  const innings = regularInningsOf(draft).find((item) => item.battingSide === side)
  const wickets = innings?.wickets ?? null
  const prefillSide = prefill?.sides.find((candidate) => candidate.side === side) ?? null
  const players = playersOfSide(scorecard, side)
  const rows = battingOf(scorecard, side)
  const byKey = playersByKey(scorecard)
  const duplicates = duplicatePlayerKeys(scorecard, side)
  const [resetOpen, setResetOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [populating, setPopulating] = useState(false)
  const [fromSquad, setFromSquad] = useState(false)
  const [populateFailed, setPopulateFailed] = useState(false)

  const commit = (next: Scorecard) => onReplace(withScorecard(draft, next))
  // Applies the not-out rule to the side's batters after any edit.
  const filled = (next: Scorecard): Scorecard => {
    const current = battingOf(next, side)
    const result = applyWicketFill(current, wickets)
    return sameFill(current, result) ? next : setBatting(next, side, result)
  }

  // First open of a side: build the grid from the selection; later, keep the not-out rule in step with the Scores step.
  useEffect(() => {
    if (players.length === 0) {
      const built = prefillState === 'ready' ? ensureSideFromPrefill(scorecard, prefillSide, wickets) : null
      if (built) commit(built)
      return
    }
    const next = filled(scorecard)
    if (next !== scorecard) commit(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, wickets, prefillState, players.length])

  // Populate from the team: the team selection when there is one, else the team's season squad (jersey number, then name,
  // the first eleven). Either way the wickets decide who is editable and who is Did not bat.
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

  const person = (key: string): PersonName => {
    const found = byKey.get(key)
    return found ? scorecardPersonName(found) : { firstName: '', lastName: '' }
  }
  const view: PersonName[] = players.map((player) => scorecardPersonName(player))
  const label = usePlayerLabeler(view)
  const plannedPeople = new Map((prefillSide?.players ?? []).map((player) => [player.playerProfileId, player]))

  const edit = (key: string, patch: Partial<BattingEntry>) => commit(filled(patchBatting(scorecard, key, patch)))
  const ids = rows.map((entry) => entryPlayerKey(entry) as string)
  const onReorder = (order: string[]) =>
    commit(filled(setBatting(scorecard, side, order.map((id) => rows.find((entry) => entryPlayerKey(entry) === id) as BattingEntry))))
  const reorder = useReorderableRows({ ids, onReorder })
  // A how-out chosen by the manager is theirs (not automatic); Did not bat clears the figures the row cannot have.
  const changeHowOut = (key: string, value: BattingEntry['howOut']) =>
    edit(key, { howOut: value, auto: false, ...(value === 'DID_NOT_BAT' ? { runs: null, balls: null, fours: null, sixes: null } : {}) })

  const taken: Record<string, string> = {}
  const takenGuests: string[] = []
  for (const player of players) {
    if (player.substitute) continue
    if (player.playerProfileId) taken[player.playerProfileId] = 'Already on the list'
    else if (player.displayName) takenGuests.push(player.displayName)
  }
  const hints: Record<string, string> = {}
  for (const planned of prefillSide?.players ?? []) if (planned.substitute) hints[planned.playerProfileId] = '12th man'

  const actions = usePlayerActions({
    clubId,
    seasonId: match.seasonId,
    ours,
    scorecard,
    onScorecard: (next) => commit(filled(next)),
    ids,
    positionLabel: 'Batting position',
    view,
    hints,
    onReorder,
    removeLabel: 'Remove from the scorecard',
    removeDescription: (name) => `${name} comes off the scorecard, along with any bowling and fielding figures entered for them.`,
    onRemove: (key) => commit(filled(removePlayer(scorecard, key))),
    addTakenPlayers: taken,
    addTakenGuests: takenGuests,
    onAdd: (identity) => commit(filled(addPlayer(scorecard, side, identity, newRowFill(rows, wickets).howOut).scorecard)),
    disabled,
  })

  const captionOf = (key: string, entry: BattingEntry): string | null => {
    const player = byKey.get(key)
    if (!player) return null
    const parts: string[] = []
    if (player.replacedPlayerProfileId) {
      const replaced = plannedPeople.get(player.replacedPlayerProfileId)
      parts.push(replaced ? `replaced ${label({ id: replaced.playerProfileId, firstName: replaced.firstName, lastName: replaced.lastName })}` : 'swapped in')
    }
    if (player.plannedBattingOrder != null && entry.position !== player.plannedBattingOrder && entry.howOut !== 'DID_NOT_BAT') {
      parts.push(`planned ${player.plannedBattingOrder}`)
    }
    return parts.length > 0 ? parts.join(' · ') : null
  }

  const totals = battingTotals(
    rows.filter((entry) => entry.howOut !== 'DID_NOT_BAT'),
    innings,
    innings?.runs,
  )
  const out = dismissalCount(rows)
  const incomplete = Object.fromEntries(oursSides.map((candidate) => [candidate.side, stepIncomplete(draft, candidate.side, 'batting')]))

  const columns: ScorecardGridColumn<BattingEntry>[] = [
    {
      id: 'howOut',
      header: 'How out',
      render: (entry) => {
        const key = entryPlayerKey(entry) as string
        return (
          <HowOutSelect
            value={entry.howOut}
            auto={entry.auto}
            disabled={disabled}
            ariaLabel={`How out, ${label(person(key))}`}
            onChange={(value) => changeHowOut(key, value)}
          />
        )
      },
    },
    ...(['runs', 'balls', 'fours', 'sixes'] as const).map((field) => ({
      id: field,
      header: { runs: 'R', balls: 'B', fours: '4s', sixes: '6s' }[field],
      align: 'right' as const,
      width: 72,
      render: (entry: BattingEntry) => {
        const key = entryPlayerKey(entry) as string
        return (
          <GridNumberInput
            value={entry[field]}
            onChange={(value) => edit(key, { [field]: value })}
            ariaLabel={`${{ runs: 'Runs', balls: 'Balls', fours: 'Fours', sixes: 'Sixes' }[field]}, ${label(person(key))}`}
            column={field}
            disabled={disabled || entry.howOut === 'DID_NOT_BAT'}
          />
        )
      },
    })),
  ]

  const star = (entry: BattingEntry) => {
    if (!canFeatureBatter(entry)) return null
    const key = entryPlayerKey(entry) as string
    return (
      <StandoutToggle
        suggested={Boolean(entry.suggested)}
        override={entry.featuredOverride}
        onChange={(override) => edit(key, { featuredOverride: override })}
        playerLabel={label(person(key))}
      />
    )
  }

  const playerCell = (entry: BattingEntry) => {
    const key = entryPlayerKey(entry) as string
    const player = byKey.get(key)
    return (
      <ScorecardPlayerCell
        person={person(key)}
        view={view}
        guest={!player?.playerProfileId}
        duplicate={duplicates.has(key)}
        caption={captionOf(key, entry)}
        onOpen={(anchor) => actions.openMenu(key, anchor)}
        disabled={disabled}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <ScorecardStepHeader
        oursSides={oursSides}
        scorecardSide={side}
        onSideChange={onScorecardSideChange}
        incomplete={incomplete}
      />
      <FormSectionHeading icon={<SportsCricketOutlinedIcon />} title={`${ours.teamName} batting`} />

      {innings && (
        <InningsSummaryCard
          teamName={ours.teamName}
          innings={innings}
          ballsPerOver={draft.ballsPerOver ?? 6}
          onChange={(patch) => onReplace(updateInnings(draft, innings.sequence ?? 1, patch))}
          disabled={disabled}
        />
      )}

      {!innings || innings.runs === null ? (
        <Alert severity="info">Enter this side's innings on the Scores step first; the batting card is checked against it.</Alert>
      ) : (
        <>
          <ReconcileStrip
            tone={wickets === null ? 'neutral' : out === wickets ? 'ok' : out > wickets ? 'warning' : 'neutral'}
            title={wickets === null ? `Out ${out}` : `Out ${out} of ${wickets}`}
            status={
              wickets === null
                ? 'Enter the wickets on the Scores step'
                : out === wickets
                  ? 'matches the result'
                  : out > wickets
                    ? `${out - wickets} more than the result says`
                    : `${wickets - out} still to mark`
            }
            progress={
              wickets === null
                ? undefined
                : { value: out, max: Math.max(wickets, 1), ariaLabel: 'Batters out', valueText: `${out} of ${wickets} wickets` }
            }
          />

          {/* Extras and the total sit above the rows so they stay put as players are added. */}
          <ReconcileStrip
            tone={totals.status === 'match' ? 'ok' : totals.status === 'mismatch' ? 'warning' : 'neutral'}
            title={
              totals.status === 'match'
                ? `Total ${totals.total} = ${totals.offBat} off the bat + ${totals.extras} extras`
                : `Card adds up to ${totals.total} = ${totals.offBat} off the bat + ${totals.extras} extras`
            }
            status={
              totals.status === 'match'
                ? 'matches the innings total'
                : totals.status === 'mismatch'
                  ? `${Math.abs(totals.difference)} ${totals.difference > 0 ? 'more' : 'fewer'} than the innings total of ${totals.inningsRuns}`
                  : undefined
            }
          />

          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
              Extras
            </Typography>
            <ExtrasFields
              value={innings}
              owner={ours.teamName}
              disabled={disabled}
              onChange={(patch) => onReplace(updateInnings(draft, innings.sequence ?? 1, patch))}
            />
          </Box>

          {rows.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
              <Button variant="secondary" startIcon={<GroupAddOutlinedIcon />} onClick={() => void populate()} disabled={disabled || populating || prefillState === 'loading'}>
                {populating ? 'Loading the team…' : 'Populate from the team'}
              </Button>
              {prefillState === 'ready' && !(prefillSide && prefillSide.players.length > 0) && (
                <Alert
                  severity="info"
                  sx={{ width: '100%' }}
                  action={
                    <Button variant="ghost" size="sm" onClick={() => (onSaveAndNavigate ? onSaveAndNavigate(selectTeamPath(match.id, null, side === 'HOME')) : navigate(selectTeamPath(match.id, null, side === 'HOME')))}>
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
          {fromSquad && rows.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              No team selection found: using the squad.
            </Typography>
          )}

          {prefillSide && prefillSide.players.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                Pre-filled from the announced team. Nothing is saved until you move on or save the draft.
              </Typography>
              <Button variant="ghost" size="sm" startIcon={<RestartAltIcon />} onClick={() => setResetOpen(true)} disabled={disabled}>
                Reset to selection
              </Button>
            </Box>
          )}
          {prefillState === 'loading' && players.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Loading the selected team…
            </Typography>
          )}

          <ScorecardGrid<BattingEntry>
            ariaLabel={`${ours.teamName} batting`}
            rows={rows}
            getRowId={(entry) => entryPlayerKey(entry) as string}
            columns={columns}
            renderPlayer={playerCell}
            renderTrailing={star}
            reorder={reorder}
            reorderDisabled={disabled}
            isRowMuted={(entry) => entry.howOut === 'DID_NOT_BAT'}
            onPickPlayer={(rowId) => actions.openSwap(rowId)}
            emptyMessage="No batters yet. Add the players who batted."
            renderCard={(entry) => {
              const key = entryPlayerKey(entry) as string
              const dnb = entry.howOut === 'DID_NOT_BAT'
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 700, width: 22, flex: 'none' }}>
                      {entry.position}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>{playerCell(entry)}</Box>
                    {star(entry)}
                  </Box>
                  <HowOutSelect
                    fullWidth
                    value={entry.howOut}
                    auto={entry.auto}
                    disabled={disabled}
                    ariaLabel={`How out, ${label(person(key))}`}
                    onChange={(value) => changeHowOut(key, value)}
                  />
                  {!dnb && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, max-content))', gap: 1, justifyContent: 'space-between' }}>
                      {(['runs', 'balls', 'fours', 'sixes'] as const).map((field) => (
                        <Box key={field}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {{ runs: 'Runs', balls: 'Balls', fours: '4s', sixes: '6s' }[field]}
                          </Typography>
                          <GridNumberInput
                            stepper
                            value={entry[field]}
                            onChange={(value) => edit(key, { [field]: value })}
                            ariaLabel={`${{ runs: 'Runs', balls: 'Balls', fours: 'Fours', sixes: 'Sixes' }[field]}, ${label(person(key))}`}
                            column={field}
                            disabled={disabled}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )
            }}
          />

          <Box>
            <Button variant="secondary" size="sm" startIcon={<AddIcon />} onClick={actions.openAdd} disabled={disabled}>
              Add player
            </Button>
          </Box>
        </>
      )}

      {actions.host}

      <ConfirmDialog
        open={resetOpen}
        title="Reset to selection?"
        description="Adds any selected players who are missing from the list and refreshes the planned batting order. Rows you have entered are kept."
        confirmLabel="Reset"
        onConfirm={() => {
          setResetOpen(false)
          if (!prefillSide) return
          const merged = resetToSelection({ players, batting: rows }, prefillSide)
          commit(
            filled({
              ...scorecard,
              players: [...scorecard.players.filter((player) => player.side !== side), ...merged.players],
              batting: [...scorecard.batting.filter((entry) => entry.battingSide !== side), ...merged.batting],
            }),
          )
        }}
        onClose={() => setResetOpen(false)}
      />
    </Box>
  )
}
