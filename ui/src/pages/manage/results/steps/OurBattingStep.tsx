import { useEffect } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import type { BattingEntry, Scorecard } from '../../../../api/matchResultApi'
import { Button } from '../../../../components/Button'
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
import { entryPlayerKey } from '../../../../utils/scorecardPrefill'
import { dismissalCount, applyBattedWindow, applyWicketFill } from '../../../../utils/wicketFill'
import { regularInningsOf, updateInnings } from '../resultDraftHelpers'
import { BattingOrderPrompt } from '../scorecard/BattingOrderPrompt'
import { InningsSummaryCard } from '../scorecard/InningsSummaryCard'
import { ScorecardPlayerCell } from '../scorecard/ScorecardPlayerCell'
import { ScorecardStepHeader } from '../scorecard/ScorecardStepHeader'
import { usePlayerActions } from '../scorecard/usePlayerActions'
import {
  applyCalculatedFigure,
  editInningsFigure,
  inningsSuggestions,
  syncInningsFromScorecard,
  wicketsOwned,
  duplicatePlayerKeys,
  battingOf,
  ensureSideFromPrefill,
  reconcileSubstitutes,
  patchBatting,
  playersByKey,
  playersOfSide,
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
  battingOrderKnown,
  onBattingOrder,
  sides,
  onGoToStep,
}: ScorecardStepProps) {
  const ours = oursSides.find((candidate) => candidate.side === scorecardSide) ?? oursSides[0]
  const side = ours.side
  const scorecard = scorecardOf(draft)
  const innings = regularInningsOf(draft).find((item) => item.battingSide === side)
  // Only wickets the manager typed drive the not-out / did-not-bat fill; calculated wickets just follow the dismissals.
  const wickets = innings && wicketsOwned(innings) ? (innings.wickets ?? null) : null
  const prefillSide = prefill?.sides.find((candidate) => candidate.side === side) ?? null
  const players = playersOfSide(scorecard, side)
  const rows = battingOf(scorecard, side)
  const byKey = playersByKey(scorecard)
  const duplicates = duplicatePlayerKeys(scorecard, side)

  // Every edit also recalculates the innings from the scorecard (unless the manager corrected a figure).
  const selectionSubstitutes = new Set((prefillSide?.players ?? []).filter((candidate) => candidate.substitute).map((candidate) => candidate.playerProfileId))
  const commit = (next: Scorecard) => onReplace(syncInningsFromScorecard(withScorecard(draft, reconcileSubstitutes(next, selectionSubstitutes))))
  // Applies the not-out rule to the side's batters after any edit.
  const filled = (next: Scorecard): Scorecard => {
    const current = battingOf(next, side)
    const result = applyWicketFill(applyBattedWindow(current, wickets), wickets)
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

  const actions = usePlayerActions({
    clubId,
    seasonId: match.seasonId,
    ours,
    scorecard,
    onScorecard: (next) => commit(filled(next)),
    ids,
    positionLabel: 'Batting position',
    view,
    onReorder,
    menuSwap: false,
    menuLink: false,
    removeKind: () => ({ kind: 'dnb' }),
    onSetDidNotBat: (key) => changeHowOut(key, 'DID_NOT_BAT'),
    removeLabel: 'Remove from the team',
    removeDescription: () => '',
    onRemove: () => {},
    disabled,
  })

  const captionOf = (key: string, entry: BattingEntry): string | null => {
    const player = byKey.get(key)
    if (!player) return null
    const parts: string[] = []
    if (player.playerProfileId && selectionSubstitutes.has(player.playerProfileId)) parts.push('12th man')
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
      header: { runs: 'Runs', balls: 'Balls', fours: '4s', sixes: '6s' }[field],
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

      {!innings ? null : !battingOrderKnown ? (
        <BattingOrderPrompt sides={sides} onChoose={(first) => onBattingOrder?.(first)} disabled={disabled} />
      ) : (
        <>
          <InningsSummaryCard
            teamName={ours.teamName}
            innings={innings}
            ballsPerOver={draft.ballsPerOver ?? 6}
            calculated={inningsSuggestions(draft).get(innings.sequence ?? 1)}
            onEdit={(field, value) => onReplace(editInningsFigure(draft, innings.sequence ?? 1, field, value))}
            onUseCalculated={(field) => onReplace(applyCalculatedFigure(draft, innings.sequence ?? 1, field))}
            disabled={disabled}
          />
          {/* Typed wickets get a meter only while the dismissals disagree; calculated wickets need only a hint. */}
          {wickets !== null && out !== wickets && (
            <ReconcileStrip
              tone={out > wickets ? 'warning' : 'neutral'}
              title={`Out ${out} of ${wickets}`}
              status={out > wickets ? `${out - wickets} more than the result says` : `${wickets - out} still to mark`}
              progress={{ value: out, max: Math.max(wickets, 1), ariaLabel: 'Batters out', valueText: `${out} of ${wickets} wickets` }}
            />
          )}
          {wickets === null && out === 0 && (
            <Typography variant="caption" color="text.secondary">
              Wickets follow the dismissals. Type them above to fill the rest.
            </Typography>
          )}

          {/* Extras and the total sit above the rows so they stay put as players are added. */}
          {/* Only a card that does not add up to the innings total needs a strip; a calculated total says so in the card. */}
          {totals.status === 'mismatch' && (
            <ReconcileStrip
              tone="warning"
              title={`Card adds up to ${totals.total} = ${totals.offBat} off the bat + ${totals.extras} extras`}
              status={`${Math.abs(totals.difference)} ${totals.difference > 0 ? 'more' : 'fewer'} than the innings total of ${totals.inningsRuns}`}
            />
          )}

          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
              Extras
            </Typography>
            <ExtrasFields
              value={innings}
              owner={ours.teamName}
              disabled={disabled}
              onChange={(patch) => onReplace(syncInningsFromScorecard(updateInnings(draft, innings.sequence ?? 1, patch)))}
            />
          </Box>

          {rows.length === 0 && (
            <Alert
              severity="info"
              action={
                <Button variant="ghost" size="sm" onClick={() => onGoToStep?.('our-team', side)}>
                  Open Our team
                </Button>
              }
            >
              No team yet. Add players on Our team.
            </Alert>
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

        </>
      )}

      {actions.host}

    </Box>
  )
}
