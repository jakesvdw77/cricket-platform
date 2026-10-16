import { useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import type { BattingEntry, ResultSide, Scorecard } from '../../../../api/matchResultApi'
import { ExtrasFields } from '../../../../components/ExtrasFields'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { HowOutSelect } from '../../../../components/HowOutSelect'
import { ReconcileStrip } from '../../../../components/ReconcileStrip'
import { GridNumberInput, ScorecardGrid } from '../../../../components/ScorecardGrid'
import type { ScorecardGridColumn } from '../../../../components/ScorecardGrid'
import { StandoutToggle } from '../../../../components/StandoutToggle'
import { useReorderableRows } from '../../../../hooks/useReorderableRows'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { battingRowChecks } from '../../../../utils/scorecardRowChecks'
import { canFeatureBatter } from '../../../../utils/standout'
import { battingTotals, extrasTotal } from '../../../../utils/battingTotals'
import { allowsBowler, allowsFielder } from '../../../../utils/dismissal'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { entryPlayerKey, playerRowKey } from '../../../../utils/scorecardPrefill'
import { dismissalCount, applyWicketFill, newRowFill, normalizeBatterFigures } from '../../../../utils/wicketFill'
import { opposite, regularInningsOf, updateInnings } from '../resultDraftHelpers'
import { AddPlayerRow } from '../scorecard/AddPlayerRow'
import { BattingOrderPrompt } from '../scorecard/BattingOrderPrompt'
import { InningsHintBanner } from '../scorecard/InningsHintBanner'
import { InningsSummaryCard } from '../scorecard/InningsSummaryCard'
import { NotSelectedBanner } from '../scorecard/NotSelectedBanner'
import { PlayerPickCombo } from '../scorecard/PlayerPickCombo'
import type { PickOption } from '../scorecard/PlayerPickCombo'
import { ScorecardPlayerCell } from '../scorecard/ScorecardPlayerCell'
import { ScorecardStepHeader } from '../scorecard/ScorecardStepHeader'
import { useAddPlayerSupport } from '../scorecard/useAddPlayerSupport'
import { useGuessActions } from '../scorecard/useGuessActions'
import { usePlayerActions } from '../scorecard/usePlayerActions'
import {
  addPlayer,
  applyCalculatedFigure,
  battingOf,
  bowlingOf,
  dismissalPatch,
  duplicatePlayerKeys,
  editInningsFigure,
  ensureBattingRows,
  ensureSideFromPrefill,
  inningsSuggestions,
  ourTeamNotice,
  patchBatting,
  playersByKey,
  playersOfSide,
  reconcileSubstitutes,
  scorecardOf,
  setBatting,
  stepIncomplete,
  syncInningsFromScorecard,
  withScorecard,
  wicketsOwned,
} from '../scorecardDraft'
import type { ScorecardStepProps } from './stepTypes'

const sameFill = (a: BattingEntry[], b: BattingEntry[]) => a.every((entry, index) => entry === b[index])

// docs/specs/101-match-results-our-side-scorecard.md, step "Batting" (decision 22): the batters of the side shown, in the
// order they batted, for either side. Rows are the side's Teams list (ours: pre-filled from the selection, built here and
// written only by a save; the opposition: the typed names); a trailing row types a name to add a player without going back
// to Teams. Driven by the wickets (once the dismissals equal them the rest become Not out), with the keyboard-first grid, a
// card per batter on a phone, the dismissal's Fielder and Bowler picked from the OTHER side's list (a new name is added
// from the control), the totals strip and the extras. Reorder by drag handle or the name popup.
export function BattingStep({
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
  const side: ResultSide = scorecardSide
  const fieldingSide = opposite(side)
  const ours = oursSides.find((candidate) => candidate.side === side) ?? null
  const fieldingOurs = oursSides.some((candidate) => candidate.side === fieldingSide)
  const teamName = sides.find((candidate) => candidate.side === side)?.name ?? ''
  const scorecard = scorecardOf(draft)
  const innings = regularInningsOf(draft).find((item) => item.battingSide === side)
  // Only wickets the manager typed drive the not-out / did-not-bat fill; calculated wickets just follow the dismissals.
  const wickets = innings && wicketsOwned(innings) ? (innings.wickets ?? null) : null
  // The automatic Not outs follow only the wickets the manager typed: calculated wickets equal the dismissals by construction,
  // so using them would hand out Not outs as soon as the first dismissal is marked.
  const fillWickets = wickets
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
    const ensured = ensureBattingRows(next, side)
    const current = battingOf(ensured, side)
    const result = normalizeBatterFigures(applyWicketFill(current, fillWickets))
    return sameFill(current, result) ? ensured : setBatting(ensured, side, result)
  }

  // First open of an ours side: build the grid from the selection; later, keep the not-out rule in step with the innings.
  useEffect(() => {
    if (players.length === 0) {
      const built = ours && prefillState === 'ready' ? ensureSideFromPrefill(scorecard, prefillSide, wickets) : null
      if (built) commit(built)
      return
    }
    const next = filled(scorecard)
    if (next !== scorecard) commit(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, fillWickets, prefillState, players.length])

  const person = (key: string): PersonName => {
    const found = byKey.get(key)
    return found ? scorecardPersonName(found) : { firstName: '', lastName: '' }
  }
  // Everyone on screen together: this side's batters and the other side's players in the dismissal pickers.
  const fielders = playersOfSide(scorecard, fieldingSide)
  const view: PersonName[] = [...players, ...fielders].map((player) => scorecardPersonName(player))
  const label = usePlayerLabeler(view)
  const plannedPeople = new Map((prefillSide?.players ?? []).map((player) => [player.playerProfileId, player]))

  const edit = (key: string, patch: Partial<BattingEntry>) => commit(filled(patchBatting(scorecard, key, patch)))
  const ids = rows.map((entry) => entryPlayerKey(entry) as string)
  const onReorder = (order: string[]) =>
    commit(filled(setBatting(scorecard, side, order.map((id) => rows.find((entry) => entryPlayerKey(entry) === id) as BattingEntry))))
  const reorder = useReorderableRows({ ids, onReorder })
  // A how-out chosen by the manager is theirs (not automatic); Did not bat clears the figures the row cannot have, and a
  // dismissal that does not take a bowler or fielder drops them.
  const changeHowOut = (key: string, value: BattingEntry['howOut']) =>
    edit(key, { ...dismissalPatch(value), auto: false, ...(value === 'DID_NOT_BAT' ? { runs: null, balls: null, fours: null, sixes: null } : {}) })

  const actions = usePlayerActions({
    clubId,
    seasonId: match.seasonId,
    ours: { side, teamId: ours?.teamId ?? null },
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

  // docs/specs/104: the Guess chips of an imported draft, for the batter and for the dismissal's fielder and bowler.
  const guesses = useGuessActions({ clubId, seasonId: match.seasonId, oursSides, prefill, scorecard, onScorecard: (next) => commit(filled(next)) })

  // ---- typing a name adds the player to the team ----
  const support = useAddPlayerSupport({ clubId, matchId: match.id, seasonId: match.seasonId, side, ours, scorecard, prefillSide, label })
  const addTo = (identity: Parameters<typeof addPlayer>[2]) => {
    commit(filled(addPlayer(scorecard, side, identity, newRowFill(battingOf(scorecard, side), wickets).howOut).scorecard))
  }
  const addNames = (names: string[]) => {
    let next = scorecard
    for (const name of names) next = addPlayer(next, side, support.nameIdentity(name), newRowFill(battingOf(next, side), wickets).howOut).scorecard
    commit(filled(next))
  }

  // ---- the dismissal's Fielder and Bowler: the other side's players ----
  const bowlerKeys = new Set(bowlingOf(scorecard, fieldingSide).map((entry) => entryPlayerKey(entry)))
  const fielderOptions: PickOption[] = fielders.map((player) => ({
    key: playerRowKey(player),
    label: label(scorecardPersonName(player)),
    hint: player.substitute ? (fieldingOurs ? '12th man or substitute' : 'Substitute') : undefined,
  }))
  const bowlerOptions: PickOption[] = [
    ...fielderOptions.filter((option) => bowlerKeys.has(option.key)).map((option) => ({ ...option, hint: 'Bowler' })),
    ...fielderOptions.filter((option) => !bowlerKeys.has(option.key)),
  ]
  // Typing a name that is not on the other side's list creates the player there (a new name for the opposition, a guest for
  // our side) and names them on the dismissal.
  const nameOnDismissal = (key: string, field: 'bowlerPlayerId' | 'fielderPlayerId', name: string) => {
    const identity = { playerProfileId: null, displayName: name, opposition: !fieldingOurs }
    const fieldingWickets = (() => {
      const other = regularInningsOf(draft).find((item) => item.battingSide === fieldingSide)
      return other && wicketsOwned(other) ? (other.wickets ?? null) : null
    })()
    const added = addPlayer(scorecard, fieldingSide, identity, newRowFill(battingOf(scorecard, fieldingSide), fieldingWickets).howOut)
    commit(filled(patchBatting(added.scorecard, key, { [field]: added.key })))
  }
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
  const incomplete = Object.fromEntries(sides.map((candidate) => [candidate.side, stepIncomplete(draft, candidate.side, 'batting')]))
  const notice = ours ? ourTeamNotice(prefillSide, scorecard, side, prefillState === 'ready') : null

  const dismissalPicker = (entry: BattingEntry, field: 'fielderPlayerId' | 'bowlerPlayerId', fullWidth = false) => {
    const key = entryPlayerKey(entry) as string
    const isFielder = field === 'fielderPlayerId'
    return (
      <PlayerPickCombo
        ariaLabel={`${isFielder ? 'Fielder' : 'Bowler'}, ${label(person(key))}`}
        value={entry[field] ?? null}
        options={isFielder ? fielderOptions : bowlerOptions}
        onPick={(picked) => edit(key, { [field]: picked })}
        onAddNew={(name) => nameOnDismissal(key, field, name)}
        addLabel={fieldingOurs ? 'Add as a guest' : 'Add a new name'}
        placeholder={isFielder ? 'Fielder' : 'Bowler'}
        column={isFielder ? 'fielder' : 'bowler'}
        disabled={disabled}
        fullWidth={fullWidth}
        warn={battingRowChecks(entry).cells.has(isFielder ? 'fielder' : 'bowler')}
        guess={entry[field] ? guesses.guessOf(byKey.get(entry[field] as string)) : undefined}
      />
    )
  }

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
            warn={battingRowChecks(entry).cells.has('howOut')}
            disabled={disabled}
            ariaLabel={`How out, ${label(person(key))}`}
            onChange={(value) => changeHowOut(key, value)}
          />
        )
      },
    },
    { id: 'fielder', header: 'Fielder', minWidth: 170, render: (entry) => (allowsFielder(entry.howOut) ? dismissalPicker(entry, 'fielderPlayerId') : null) },
    { id: 'bowler', header: 'Bowler', minWidth: 170, render: (entry) => (allowsBowler(entry.howOut) ? dismissalPicker(entry, 'bowlerPlayerId') : null) },
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
            warn={(field === 'runs' || field === 'balls') && battingRowChecks(entry).cells.has(field)}
            disabled={disabled || (entry.howOut === 'DID_NOT_BAT' && !entry.auto)}
          />
        )
      },
    })),
  ]

  // The opposition has no standouts: no star on its rows.
  const star = (entry: BattingEntry) => {
    if (!ours || !canFeatureBatter(entry)) return null
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
        guest={Boolean(player) && !player?.playerProfileId && !player?.opposition}
        duplicate={duplicates.has(key)}
        caption={captionOf(key, entry)}
        onOpen={(anchor) => actions.openMenu(key, anchor)}
        disabled={disabled}
        guess={guesses.guessOf(player)}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <ScorecardStepHeader sides={sides} scorecardSide={side} onSideChange={onScorecardSideChange} incomplete={incomplete} ariaLabel="Team batting" />
      <FormSectionHeading icon={<SportsCricketOutlinedIcon />} title={`${teamName} batting`} />
      {notice && <NotSelectedBanner notice={notice} onOpenTeams={onGoToStep ? () => onGoToStep('teams', side) : undefined} disabled={disabled} />}
      <InningsHintBanner />

      {!innings ? null : !battingOrderKnown ? (
        <BattingOrderPrompt sides={sides} onChoose={(first) => onBattingOrder?.(first)} disabled={disabled} />
      ) : (
        <>
          <InningsSummaryCard
            teamName={teamName}
            innings={innings}
            ballsPerOver={draft.ballsPerOver ?? 6}
            calculated={inningsSuggestions(draft).get(innings.sequence ?? 1)}
            warning={totals.status === 'mismatch' ? 'Runs differ from the batting card' : null}
            onEdit={(field, value) => onReplace(editInningsFigure(draft, innings.sequence ?? 1, field, value))}
            onUseCalculated={(field) => onReplace(applyCalculatedFigure(draft, innings.sequence ?? 1, field))}
            disabled={disabled}
          />
          {/* Typed wickets get a meter only while the dismissals disagree; calculated wickets need only a hint. */}
          {wickets !== null && out !== wickets && (
            <ReconcileStrip
              tone={out > wickets ? 'warning' : 'neutral'}
              title={`Out ${out} of ${wickets}`}
              status={out > wickets ? `${out - wickets} more than the result says` : `${wickets - out} more to mark`}
              progress={{ value: out, max: Math.max(wickets, 1), ariaLabel: 'Batters out', valueText: `${out} of ${wickets} wickets` }}
            />
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
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-start', gap: 1.5, mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Extras
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                Total {extrasTotal(innings)}
              </Typography>
            </Box>
            <ExtrasFields
              hideTotal
              value={innings}
              owner={teamName}
              disabled={disabled}
              onChange={(patch) => onReplace(syncInningsFromScorecard(updateInnings(draft, innings.sequence ?? 1, patch)))}
            />
          </Box>

          {rows.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {ours ? 'No team yet. Type a name below, or add players on Teams.' : 'No batters yet. Type their names below, one per line, or paste a list.'}
            </Typography>
          )}

          <ScorecardGrid<BattingEntry>
            ariaLabel={`${teamName} batting`}
            rows={rows}
            getRowId={(entry) => entryPlayerKey(entry) as string}
            columns={columns}
            renderPlayer={playerCell}
            renderTrailing={star}
            reorder={reorder}
            reorderDisabled={disabled}
            isRowMuted={(entry) => entry.howOut === 'DID_NOT_BAT'}
            isRowFlagged={(entry) => guesses.guessOf(byKey.get(entryPlayerKey(entry) as string)) !== undefined}
            rowProblem={(entry) => battingRowChecks(entry).reasons.join('. ') || null}
            emptyMessage={null}
            renderCard={(entry) => {
              const key = entryPlayerKey(entry) as string
              // Only an explicit Did not bat hides the figures: an automatic one flips as soon as a figure is typed.
              const dnb = entry.howOut === 'DID_NOT_BAT' && !entry.auto
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
                    warn={battingRowChecks(entry).cells.has('howOut')}
                    disabled={disabled}
                    ariaLabel={`How out, ${label(person(key))}`}
                    onChange={(value) => changeHowOut(key, value)}
                  />
                  {(allowsFielder(entry.howOut) || allowsBowler(entry.howOut)) && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1 }}>
                      {allowsFielder(entry.howOut) && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
                            Fielder
                          </Typography>
                          {dismissalPicker(entry, 'fielderPlayerId', true)}
                        </Box>
                      )}
                      {allowsBowler(entry.howOut) && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
                            Bowler
                          </Typography>
                          {dismissalPicker(entry, 'bowlerPlayerId', true)}
                        </Box>
                      )}
                    </Box>
                  )}
                  {!dnb && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, max-content))', gap: 1, justifyContent: 'space-between' }}>
                      {(['runs', 'balls', 'fours', 'sixes'] as const).map((field) => (
                        <Box key={field}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
                            {{ runs: 'Runs', balls: 'Balls', fours: '4s', sixes: '6s' }[field]}
                          </Typography>
                          <GridNumberInput
                            stepper
                            value={entry[field]}
                            onChange={(value) => edit(key, { [field]: value })}
                            ariaLabel={`${{ runs: 'Runs', balls: 'Balls', fours: 'Fours', sixes: 'Sixes' }[field]}, ${label(person(key))}`}
                            column={field}
                            warn={(field === 'runs' || field === 'balls') && battingRowChecks(entry).cells.has(field)}
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

          <AddPlayerRow
            options={support.options}
            addLabel={support.addLabel}
            existingNames={players.map((player) => player.displayName ?? '')}
            onPick={(key) => {
              const identity = support.identityOf(key)
              if (identity) addTo(identity)
            }}
            onAddName={(name) => addTo(support.nameIdentity(name))}
            onAddNames={addNames}
            disabled={disabled}
          />
        </>
      )}

      {actions.host}
      {guesses.host}
    </Box>
  )
}
