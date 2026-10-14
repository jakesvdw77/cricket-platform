import { useEffect, useId } from 'react'
import { Box, Chip, IconButton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SportsBaseballOutlinedIcon from '@mui/icons-material/SportsBaseballOutlined'
import SportsHandballOutlinedIcon from '@mui/icons-material/SportsHandballOutlined'
import type { BowlingEntry, Innings, ResultPlayer, Scorecard } from '../../../../api/matchResultApi'
import { Button } from '../../../../components/Button'
import { ExtrasFields } from '../../../../components/ExtrasFields'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { OversInput } from '../../../../components/OversInput'
import { PlayerName } from '../../../../components/PlayerName'
import { badgeSx } from '../../../../components/RecordCard'
import { ReconcileStrip } from '../../../../components/ReconcileStrip'
import { GridNumberInput, ScorecardGrid } from '../../../../components/ScorecardGrid'
import type { ScorecardGridColumn } from '../../../../components/ScorecardGrid'
import { StandoutToggle } from '../../../../components/StandoutToggle'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { useReorderableRows } from '../../../../hooks/useReorderableRows'
import { canFeatureBowler, canFeatureFielder } from '../../../../utils/standout'
import { extrasTotal } from '../../../../utils/battingTotals'
import { isNonBowlerWicket } from '../../../../utils/dismissal'
import { ballsToOvers } from '../../../../utils/oversFormat'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { entryPlayerKey, playerRowKey } from '../../../../utils/scorecardPrefill'
import { regularInningsOf, updateInnings } from '../resultDraftHelpers'
import { CorrectedChip } from '../scorecard/CorrectedChip'
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
  duplicatePlayerKeys,
  blankBowlingEntry,
  battingOf,
  bowlingOf,
  bumpFielding,
  ensureSideFromPrefill,
  fieldingOf,
  matchPlayersFor,
  reconcileSubstitutes,
  figureCorrected,
  patchBowling,
  patchFielding,
  playersByKey,
  playersOfSide,
  prefillBowlers,
  scorecardOf,
  setBowling,
  stepIncomplete,
  withScorecard,
} from '../scorecardDraft'
import type { ScorecardStepProps } from './stepTypes'

const FIELDING_FIELDS = [
  { field: 'catches', label: 'Catches' },
  { field: 'stumpings', label: 'Stumpings' },
  { field: 'runOuts', label: 'Run-outs' },
] as const

const n = (value: number | null | undefined) => value ?? 0

function Counter({ label, value, onChange, disabled }: { label: string; value: number; onChange: (delta: 1 | -1) => void; disabled?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} role="group" aria-label={label}>
      <IconButton aria-label={`Decrease ${label}`} size="small" disabled={disabled || value <= 0} onClick={() => onChange(-1)} sx={{ width: 36, height: 36, border: 1, borderColor: 'divider' }}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography component="span" aria-live="polite" sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <IconButton aria-label={`Increase ${label}`} size="small" disabled={disabled} onClick={() => onChange(1)} sx={{ width: 36, height: 36, border: 1, borderColor: 'divider' }}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

// docs/specs/101-match-results-our-side-scorecard.md, step "Our bowling and fielding": for the innings the opposition
// batted, our bowlers (pre-listed from the line-up's bowlers and all-rounders) with balls (typed as overs), maidens, runs
// and wickets (wides and no-balls behind More), the "Bowled so far" strips that reconcile them with the opposition's
// innings, the opposition's extras and the wickets not credited to a bowler, then a fielding list of tap-to-increment
// counters.
export function OurBowlingStep({
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
  onGoToStep,
  sides,
}: ScorecardStepProps) {
  const ours = oursSides.find((candidate) => candidate.side === scorecardSide) ?? oursSides[0]
  const side = ours.side
  const derby = oursSides.length > 1
  const scorecard = scorecardOf(draft)
  const ballsPerOver = draft.ballsPerOver ?? 6
  const opposing = side === 'HOME' ? 'AWAY' : 'HOME'
  const opposition = regularInningsOf(draft).find((item) => item.battingSide === opposing)
  const ownInnings = regularInningsOf(draft).find((item) => item.battingSide === side)
  const oppositionName = derby ? (oursSides.find((candidate) => candidate.side === opposing)?.teamName ?? 'Opposition') : 'Opposition'
  const prefillSide = prefill?.sides.find((candidate) => candidate.side === side) ?? null
  const players = playersOfSide(scorecard, side)
  const rows = bowlingOf(scorecard, side)
  const byKey = playersByKey(scorecard)
  const duplicates = duplicatePlayerKeys(scorecard, side)
  const nonBowlerId = useId()

  const selectionSubstitutes = new Set((prefillSide?.players ?? []).filter((candidate) => candidate.substitute).map((candidate) => candidate.playerProfileId))
  const commit = (next: Scorecard) => onReplace(syncInningsFromScorecard(withScorecard(draft, reconcileSubstitutes(next, selectionSubstitutes))))

  // First open: the side's players (if Our batting was never opened) and the line-up's bowlers as blank rows.
  useEffect(() => {
    if (prefillState !== 'ready') return
    const withPlayers = ensureSideFromPrefill(scorecard, prefillSide, ownInnings?.wickets ?? null) ?? scorecard
    const withBowlers = prefillBowlers(withPlayers, side, prefillSide) ?? withPlayers
    if (withBowlers !== scorecard) commit(withBowlers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, prefillState])

  const person = (key: string): PersonName => {
    const found = byKey.get(key)
    return found ? scorecardPersonName(found) : { firstName: '', lastName: '' }
  }
  const view: PersonName[] = players.map((player) => scorecardPersonName(player))
  const label = usePlayerLabeler(view)
  const plannedPeople = new Map((prefillSide?.players ?? []).map((player) => [player.playerProfileId, player]))

  const edit = (key: string, patch: Partial<BowlingEntry>) => commit(patchBowling(scorecard, key, patch))
  const ids = rows.map((entry) => entryPlayerKey(entry) as string)
  const onReorder = (order: string[]) =>
    commit(setBowling(scorecard, side, order.map((id) => rows.find((entry) => entryPlayerKey(entry) === id) as BowlingEntry)))
  const reorder = useReorderableRows({ ids, onReorder })

  // Our bowling and fielding pick only from the side's list as defined on Our batting: every result player of the side,
  // whatever their batting status (Did not bat, the 12th man, guests). Someone not listed is added on Our team.
  const bowling = new Set(ids)
  const matchPlayers = matchPlayersFor(scorecard, side, prefillSide)
  const taken: Record<string, string> = {}
  const hints: Record<string, string> = {}
  for (const player of matchPlayers) {
    if (bowling.has(player.key)) taken[player.key] = 'Already bowling'
    else if (player.substitute || (byKey.get(player.key)?.playerProfileId && selectionSubstitutes.has(byKey.get(player.key)?.playerProfileId as string))) hints[player.key] = '12th man'
  }
  const addBowler = (key: string) => {
    const player = byKey.get(key)
    if (player && !bowling.has(key)) commit(setBowling(scorecard, side, [...rows, blankBowlingEntry(side, player, rows.length + 1)]))
  }

  const actions = usePlayerActions({
    clubId,
    seasonId: match.seasonId,
    ours,
    scorecard,
    onScorecard: commit,
    ids,
    positionLabel: 'Bowling position',
    view,
    hints,
    onReorder,
    menuSwap: false,
    menuLink: false,
    removeLabel: 'Remove bowler',
    removeDescription: (name) => `${name} comes off the bowling list. They stay on the team and any fielding credits stay.`,
    onRemove: (key) => commit(setBowling(scorecard, side, rows.filter((entry) => entryPlayerKey(entry) !== key))),
    addTitle: 'Add bowler',
    addTakenPlayers: taken,
    addFromList: { players: matchPlayers, hints, onPick: addBowler, onNotListed: () => onGoToStep?.('our-team', side) },
    disabled,
  })

  const captionOf = (key: string): string | null => {
    const player = byKey.get(key)
    if (!player) return null
    const twelfth = player.playerProfileId && selectionSubstitutes.has(player.playerProfileId) ? '12th man' : null
    if (!player.replacedPlayerProfileId) return twelfth
    const replaced = plannedPeople.get(player.replacedPlayerProfileId)
    return [twelfth, replaced ? `replaced ${label({ id: replaced.playerProfileId, firstName: replaced.firstName, lastName: replaced.lastName })}` : 'swapped in'].filter(Boolean).join(' · ')
  }

  // ---- the strips ----
  const balls = rows.reduce((sum, entry) => sum + n(entry.balls), 0)
  const bowlerRuns = rows.reduce((sum, entry) => sum + n(entry.runs), 0)
  const bowlerWickets = rows.reduce((sum, entry) => sum + n(entry.wickets), 0)
  const notCharged = n(opposition?.byes) + n(opposition?.legByes) + n(opposition?.penaltyRuns)
  const hasBreakdown = opposition != null && [opposition.wides, opposition.noBalls, opposition.byes, opposition.legByes, opposition.penaltyRuns].some((v) => v != null)
  // In a derby the other side's batters are on the scorecard, so the wickets not credited to a bowler come from them.
  const opposingBatting = derby ? battingOf(scorecard, opposing) : []
  const derivedNonBowler = derby && opposingBatting.length > 0 ? opposingBatting.filter((entry) => isNonBowlerWicket(entry.howOut)).length : null
  const nonBowler = derivedNonBowler ?? n(opposition?.nonBowlerWickets)

  const ballsTone = opposition?.balls == null ? 'neutral' : balls === opposition.balls ? 'ok' : balls > opposition.balls ? 'warning' : 'neutral'
  const runsTone =
    opposition?.runs == null
      ? 'neutral'
      : hasBreakdown
        ? bowlerRuns + notCharged === opposition.runs
          ? 'ok'
          : 'warning'
        : bowlerRuns <= opposition.runs
          ? 'neutral'
          : 'warning'
  const wicketsTone =
    opposition?.wickets == null ? 'neutral' : bowlerWickets + nonBowler === opposition.wickets ? 'ok' : bowlerWickets + nonBowler > opposition.wickets ? 'warning' : 'neutral'

  const incomplete = Object.fromEntries(oursSides.map((candidate) => [candidate.side, stepIncomplete(draft, candidate.side, 'bowling')]))

  // ---- the grid ----
  const numberColumn = (field: 'maidens' | 'runs' | 'wickets' | 'wides' | 'noBalls', header: string, name: string): ScorecardGridColumn<BowlingEntry> => ({
    id: field,
    header,
    align: 'right',
    width: 76,
    render: (entry) => {
      const key = entryPlayerKey(entry) as string
      return (
        <GridNumberInput
          value={entry[field]}
          onChange={(value) => edit(key, { [field]: value })}
          ariaLabel={`${name}, ${label(person(key))}`}
          column={field}
          disabled={disabled}
        />
      )
    },
  })

  const columns: ScorecardGridColumn<BowlingEntry>[] = [
    {
      id: 'overs',
      header: 'Overs',
      align: 'right',
      width: 84,
      render: (entry) => {
        const key = entryPlayerKey(entry) as string
        return (
          <OversInput
            label={`Overs, ${label(person(key))}`}
            gridColumn="overs"
            value={entry.balls}
            onChange={(value) => edit(key, { balls: value })}
            ballsPerOver={ballsPerOver}
            disabled={disabled}
          />
        )
      },
    },
    numberColumn('maidens', 'Maidens', 'Maidens'),
    numberColumn('runs', 'Runs', 'Runs conceded'),
    numberColumn('wickets', 'Wickets', 'Wickets'),
    numberColumn('wides', 'Wides', 'Wides'),
    numberColumn('noBalls', 'No-balls', 'No-balls'),
  ]

  const star = (entry: BowlingEntry) => {
    if (!canFeatureBowler(entry)) return null
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

  const playerCell = (entry: BowlingEntry) => {
    const key = entryPlayerKey(entry) as string
    return (
      <ScorecardPlayerCell
        person={person(key)}
        view={view}
        guest={!byKey.get(key)?.playerProfileId}
        duplicate={duplicates.has(key)}
        caption={captionOf(key)}
        onOpen={(anchor) => actions.openMenu(key, anchor)}
        disabled={disabled}
      />
    )
  }

  // Fielding: the line-up in batting order, then anyone else (the 12th man, a substitute).
  const batters = battingOf(scorecard, side).map((entry) => byKey.get(entryPlayerKey(entry) as string)).filter((player): player is ResultPlayer => Boolean(player))
  const fielders = [...batters, ...players.filter((player) => !batters.includes(player))]
  const fieldingByKey = new Map(fieldingOf(scorecard, side).map((entry) => [entryPlayerKey(entry), entry]))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <ScorecardStepHeader oursSides={oursSides} scorecardSide={side} onSideChange={onScorecardSideChange} incomplete={incomplete} />
      <FormSectionHeading icon={<SportsBaseballOutlinedIcon />} title={`${ours.teamName} bowling`} />

      {!opposition ? null : !battingOrderKnown ? (
        <BattingOrderPrompt sides={sides} onChoose={(first) => onBattingOrder?.(first)} disabled={disabled} />
      ) : (
        <>
          <InningsSummaryCard
            teamName={oppositionName}
            title={derby ? `Opposition: ${oppositionName}` : 'Opposition'}
            innings={opposition}
            ballsPerOver={ballsPerOver}
            calculated={inningsSuggestions(draft).get(opposition.sequence ?? 2)}
            onEdit={(field, value) => onReplace(editInningsFigure(draft, opposition.sequence ?? 2, field, value))}
            onUseCalculated={(field) => onReplace(applyCalculatedFigure(draft, opposition.sequence ?? 2, field))}
            disabled={disabled}
          />
          {/* The card says when the figures are calculated; a strip appears only where the bowling does not add up. */}
          {(ballsTone === 'warning' || runsTone === 'warning' || wicketsTone === 'warning') && (
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
            {ballsTone === 'warning' && (
              <ReconcileStrip
                tone={ballsTone}
                title={opposition.balls === null ? `Balls ${balls}` : `Balls ${balls} of ${opposition.balls}`}
                status={
                  opposition.balls === null
                    ? undefined
                    : balls === opposition.balls
                      ? 'all bowled'
                      : balls > opposition.balls
                        ? `${balls - opposition.balls} too many`
                        : `${opposition.balls - balls} left`
                }
                detail={opposition.balls === null ? undefined : `${ballsToOvers(balls, ballsPerOver)} of ${ballsToOvers(opposition.balls, ballsPerOver)} overs`}
              />
            )}
            {runsTone === 'warning' && (
              <ReconcileStrip
                tone={runsTone}
                title={opposition.runs === null ? `Runs ${bowlerRuns + notCharged} conceded` : `Runs ${bowlerRuns + notCharged} of ${opposition.runs} conceded`}
                status={opposition.runs === null ? undefined : hasBreakdown ? (bowlerRuns + notCharged === opposition.runs ? 'adds up' : `${Math.abs(bowlerRuns + notCharged - opposition.runs)} ${bowlerRuns + notCharged > opposition.runs ? 'too many' : 'short'}`) : 'enter the extras to check the total'}
                detail={`${bowlerRuns} charged to bowlers + ${notCharged} byes, leg byes and penalty`}
              />
            )}
            {wicketsTone === 'warning' && (
              <ReconcileStrip
                tone={wicketsTone}
                title={opposition.wickets === null ? `Wickets ${bowlerWickets} + ${nonBowler}` : `Wickets ${bowlerWickets} + ${nonBowler} = ${bowlerWickets + nonBowler} of ${opposition.wickets}`}
                status={opposition.wickets === null ? undefined : bowlerWickets + nonBowler === opposition.wickets ? 'adds up' : undefined}
                detail="Bowlers' wickets + wickets not credited to a bowler"
              />
            )}
          </Box>
          )}

          {/* The opposition's extras sit above the rows so they stay put as bowlers are added. */}
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
              {derby ? `${oppositionName} extras` : 'Opposition extras'}
            </Typography>
            <ExtrasFields
              value={opposition}
              owner={oppositionName}
              disabled={disabled}
              onChange={(patch) => {
                // Wides and no-balls are derived from the bowlers: typing one is an edit (with Reset); the rest are plain inputs.
                let next = draft
                for (const [key, value] of Object.entries(patch) as Array<[keyof Innings, number | null]>) {
                  next = key === 'wides' || key === 'noBalls' ? editInningsFigure(next, opposition.sequence ?? 2, key, value) : updateInnings(next, opposition.sequence ?? 2, { [key]: value })
                }
                onReplace(syncInningsFromScorecard(next))
              }}
              fieldNote={(key) => {
                if (key !== 'wides' && key !== 'noBalls') return null
                const calc = inningsSuggestions(draft).get(opposition.sequence ?? 2)?.[key]
                if (calc == null || !figureCorrected(opposition, key, calc)) return null
                return (
                  <CorrectedChip
                    label={`${key === 'wides' ? 'wides' : 'no-balls'}, ${oppositionName}`}
                    calculatedText={String(calc)}
                    onReset={() => onReplace(applyCalculatedFigure(draft, opposition.sequence ?? 2, key))}
                    disabled={disabled}
                  />
                )
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Wides and no-balls add up from the bowlers; byes, leg byes and penalty runs are not charged to a bowler. Extras total {extrasTotal(opposition)}.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
              <Typography component="label" htmlFor={nonBowlerId} variant="body2" sx={{ fontWeight: 600 }}>
                Wickets not credited to a bowler
              </Typography>
              {derivedNonBowler !== null ? (
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {derivedNonBowler} <Typography component="span" variant="caption" color="text.secondary">(from the {oppositionName} batting card)</Typography>
                </Typography>
              ) : (
                <GridNumberInput
                  id={nonBowlerId}
                  value={opposition.nonBowlerWickets ?? null}
                  onChange={(value) => onReplace(syncInningsFromScorecard(updateInnings(draft, opposition.sequence ?? 2, { nonBowlerWickets: value })))}
                  ariaLabel="Wickets not credited to a bowler"
                  column="nonBowlerWickets"
                  disabled={disabled}
                  width={72}
                />
              )}
              <Typography variant="caption" color="text.secondary">
                Run-outs and similar.
              </Typography>
            </Box>
          </Box>

          <ScorecardGrid<BowlingEntry>
            ariaLabel={`${ours.teamName} bowling`}
            playerHeader="Bowler"
            rows={rows}
            getRowId={(entry) => entryPlayerKey(entry) as string}
            columns={columns}
            renderPlayer={playerCell}
            renderTrailing={star}
            reorder={reorder}
            reorderDisabled={disabled}
            onPickPlayer={(rowId) => actions.openSwap(rowId)}
            emptyMessage="No bowlers yet. Add the players who bowled."
            renderCard={(entry) => {
              const key = entryPlayerKey(entry) as string
              const name = label(person(key))
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 700, width: 22, flex: 'none' }}>
                      {entry.bowlingOrder}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>{playerCell(entry)}</Box>
                    {star(entry)}
                  </Box>
                  <OversInput label="Overs" ariaLabel={`Overs, ${name}`} value={entry.balls} onChange={(value) => edit(key, { balls: value })} ballsPerOver={ballsPerOver} disabled={disabled} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, max-content))', gap: 1, justifyContent: 'space-between' }}>
                    {(
                      [
                        ['maidens', 'Maidens'],
                        ['runs', 'Runs conceded'],
                        ['wickets', 'Wickets'],
                        ['wides', 'Wides'],
                        ['noBalls', 'No-balls'],
                      ] as const
                    ).map(([field, title]) => (
                      <Box key={field}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {title}
                        </Typography>
                        <GridNumberInput stepper value={entry[field]} onChange={(value) => edit(key, { [field]: value })} ariaLabel={`${title}, ${name}`} column={field} disabled={disabled} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            }}
          />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" startIcon={<AddIcon />} onClick={actions.openAdd} disabled={disabled}>
              Add bowler
            </Button>
          </Box>
        </>
      )}

      <FormSectionHeading icon={<SportsHandballOutlinedIcon />} title={`${ours.teamName} fielding`} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
        Tap + for each catch, stumping or run-out. Only players with a credit are saved.
      </Typography>
        <Box role="list" aria-label={`${ours.teamName} fielding`} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', overflow: 'hidden' }}>
          {fielders.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No players yet. Open Our batting to load the team, or add a bowler.
            </Typography>
          )}
          {fielders.map((player, index) => {
            const key = playerRowKey(player)
            const entry = fieldingByKey.get(key)
            const name = label(scorecardPersonName(player))
            return (
              <Box
                key={key}
                role="listitem"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  bgcolor: (theme) => (index % 2 === 1 ? theme.palette.action.hover : 'transparent'),
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: { xs: '100%', sm: 200 }, flex: { sm: 1 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    <PlayerName person={scorecardPersonName(player)} view={view} />
                  </Typography>
                  {!player.playerProfileId && <Chip size="small" label="Guest" sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.7rem' }} />}
                  {(player.substitute || (player.playerProfileId && selectionSubstitutes.has(player.playerProfileId))) && <Chip size="small" label="12th man" sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.7rem' }} />}
                </Box>
                {FIELDING_FIELDS.map(({ field, label: title }) => (
                  <Box key={field} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ width: 64 }}>
                      {title}
                    </Typography>
                    <Counter label={`${title}, ${name}`} value={n(entry?.[field])} disabled={disabled} onChange={(delta) => commit(bumpFielding(scorecard, side, player, field, delta))} />
                  </Box>
                ))}
                <Box sx={{ width: 44, display: 'flex', justifyContent: 'center' }}>
                  {entry && canFeatureFielder(entry) && (
                    <StandoutToggle
                      suggested={Boolean(entry.suggested)}
                      override={entry.featuredOverride}
                      onChange={(override) => commit(patchFielding(scorecard, key, { featuredOverride: override }))}
                      playerLabel={name}
                    />
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>

      {actions.host}
    </Box>
  )
}
