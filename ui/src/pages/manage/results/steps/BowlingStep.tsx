import { useEffect, useId, useState } from 'react'
import { Alert, Box, Chip, IconButton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SportsBaseballOutlinedIcon from '@mui/icons-material/SportsBaseballOutlined'
import SportsHandballOutlinedIcon from '@mui/icons-material/SportsHandballOutlined'
import type { BowlingEntry, FieldingEntry, Innings, ResultPlayer, ResultSide, Scorecard } from '../../../../api/matchResultApi'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { ExtrasFields } from '../../../../components/ExtrasFields'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { OversInput } from '../../../../components/OversInput'
import { GuessChip } from '../../../../components/GuessChip'
import { PlayerName } from '../../../../components/PlayerName'
import { badgeSx } from '../../../../components/RecordCard'
import { ReconcileStrip } from '../../../../components/ReconcileStrip'
import { GridNumberInput, ScorecardGrid } from '../../../../components/ScorecardGrid'
import type { ScorecardGridColumn } from '../../../../components/ScorecardGrid'
import { StandoutHeader, StandoutToggle } from '../../../../components/StandoutToggle'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { useReorderableRows } from '../../../../hooks/useReorderableRows'
import { bowlingRowProblem, wicketsFullyAttributed } from '../../../../utils/scorecardRowChecks'
import { canFeatureBowler, canFeatureFielder } from '../../../../utils/standout'
import { extrasTotal } from '../../../../utils/battingTotals'
import { ballsToOvers } from '../../../../utils/oversFormat'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { entryPlayerKey, playerRowKey } from '../../../../utils/scorecardPrefill'
import { newRowFill } from '../../../../utils/wicketFill'
import { opposite, regularInningsOf, updateInnings } from '../resultDraftHelpers'
import { AddPlayerRow } from '../scorecard/AddPlayerRow'
import { CorrectedChip } from '../../../../components/CorrectedChip'
import { BattingOrderPrompt } from '../scorecard/BattingOrderPrompt'
import { DerivedMarker } from '../../../../components/DerivedMarker'
import { InningsHintBanner } from '../scorecard/InningsHintBanner'
import { InningsSummaryCard } from '../scorecard/InningsSummaryCard'
import { NotSelectedBanner } from '../scorecard/NotSelectedBanner'
import { ScorecardPlayerCell } from '../scorecard/ScorecardPlayerCell'
import { ScorecardStepHeader } from '../scorecard/ScorecardStepHeader'
import { useAddPlayerSupport } from '../scorecard/useAddPlayerSupport'
import { UseClosestButton } from '../import/UseClosestButton'
import { useGuessActions } from '../scorecard/useGuessActions'
import { usePlayerActions } from '../scorecard/usePlayerActions'
import {
  addFielder,
  addPlayer,
  applyCalculatedFigure,
  battingOf,
  blankBowlingEntry,
  bowlingOf,
  bumpFielding,
  creditFor,
  derivedNonBowlerWickets,
  dismissalsOf,
  duplicatePlayerKeys,
  editInningsFigure,
  ensureSideFromPrefill,
  fieldingOf,
  figureCorrected,
  followDismissals,
  inningsHasDismissals,
  inningsSuggestions,
  ourTeamNotice,
  patchBowling,
  patchFielding,
  playersByKey,
  playersOfSide,
  prefillBowlers,
  reconcileSubstitutes,
  scorecardOf,
  setBowling,
  stepIncomplete,
  syncInningsFromScorecard,
  withScorecard,
  wicketsOwned,
} from '../scorecardDraft'
import type { ScorecardStepProps } from './stepTypes'

const FIELDING_FIELDS = [
  { field: 'catches', label: 'Catches', short: 'Ct' },
  { field: 'stumpings', label: 'Stumpings', short: 'St' },
  { field: 'runOuts', label: 'Run-outs', short: 'RO' },
] as const

const n = (value: number | null | undefined) => value ?? 0

// docs/specs/118 (owner item 7): the fielding list is compact. One bordered pill "- 2 +" per counter, with no label of its own (the
// labels are shown once in the list's header row); the group keeps its full accessible name. The look is 30 px high, the touch
// target is 44 px (transparent ::after areas), and the value has a fixed width so the columns line up.
const COUNTER_COLUMN = { xs: 62, sm: 92 }
const FIELDING_GRID = { xs: 'minmax(0, 1fr) repeat(3, 62px) 30px', sm: 'minmax(0, 1fr) repeat(3, 92px) 72px' }

function Counter({ label, value, onChange, disabled }: { label: string; value: number; onChange: (delta: 1 | -1) => void; disabled?: boolean }) {
  const button = {
    width: { xs: 20, sm: 28 },
    height: 30,
    p: 0,
    color: 'primary.main',
    position: 'relative',
    '&::after': { content: '""', position: 'absolute', top: -7, bottom: -7, left: { xs: -2, sm: -4 }, right: { xs: -2, sm: -4 } },
  } as const
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 1, borderColor: 'divider', borderRadius: '8px', height: 30, width: COUNTER_COLUMN, bgcolor: 'background.paper', justifySelf: 'center' }}
    >
      <IconButton aria-label={`Decrease ${label}`} size="small" disabled={disabled || value <= 0} onClick={() => onChange(-1)} sx={button}>
        <RemoveIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Typography component="span" aria-live="polite" sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <IconButton aria-label={`Increase ${label}`} size="small" disabled={disabled} onClick={() => onChange(1)} sx={button}>
        <AddIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  )
}

// docs/specs/101-match-results-our-side-scorecard.md, step "Bowling and fielding" (decision 22): for the side shown, for the
// innings the other side batted: its bowlers with balls (typed as overs), maidens, runs and wickets (wides, no-balls and dot
// balls too), the "Bowled so far" strips that reconcile them with that innings, the batting side's extras and the wickets not
// credited to a bowler, then a fielding list of tap-to-increment counters. Bowlers' wickets and the fielders' counters follow
// the dismissals entered on Batting ("from dismissals") until typed over; "Use N" hands a typed figure back. Rows come from
// the Teams list; typing a name in the trailing row adds the player to the team.
export function BowlingStep({
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
  const side: ResultSide = scorecardSide
  const batted = opposite(side)
  const ours = oursSides.find((candidate) => candidate.side === side) ?? null
  const scorecard = scorecardOf(draft)
  const ballsPerOver = draft.ballsPerOver ?? 6
  const against = regularInningsOf(draft).find((item) => item.battingSide === batted)
  const ownInnings = regularInningsOf(draft).find((item) => item.battingSide === side)
  const teamName = sides.find((candidate) => candidate.side === side)?.name ?? ''
  const battingName = sides.find((candidate) => candidate.side === batted)?.name ?? 'the other side'
  const prefillSide = prefill?.sides.find((candidate) => candidate.side === side) ?? null
  const players = playersOfSide(scorecard, side)
  const rows = bowlingOf(scorecard, side)
  const byKey = playersByKey(scorecard)
  const duplicates = duplicatePlayerKeys(scorecard, side)
  const nonBowlerId = useId()
  const [bulkOpen, setBulkOpen] = useState(false)

  const selectionSubstitutes = new Set((prefillSide?.players ?? []).filter((candidate) => candidate.substitute).map((candidate) => candidate.playerProfileId))
  const commit = (next: Scorecard) => onReplace(syncInningsFromScorecard(withScorecard(draft, reconcileSubstitutes(next, selectionSubstitutes))))
  const ownWickets = ownInnings && wicketsOwned(ownInnings) ? (ownInnings.wickets ?? null) : null

  // First open of an ours side: its players (if Teams was never opened) and the line-up's bowlers as blank rows. The
  // opposition has nothing to pre-list.
  useEffect(() => {
    if (!ours || prefillState !== 'ready') return
    const withPlayers = ensureSideFromPrefill(scorecard, prefillSide, ownInnings?.wickets ?? null) ?? scorecard
    const withBowlers = prefillBowlers(withPlayers, side, prefillSide) ?? withPlayers
    if (withBowlers !== scorecard) commit(withBowlers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, prefillState])

  // Opening the step for a draft that already has dismissals: the bowlers they name get their rows.
  useEffect(() => {
    const synced = syncInningsFromScorecard(draft)
    if (synced !== draft) onReplace(synced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side])

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

  const hasDismissals = inningsHasDismissals(scorecard, batted)
  const bowlingIds = new Set(ids)

  // A new bowling row follows the dismissals when the innings already has them.
  const rowFor = (player: Pick<ResultPlayer, 'id' | 'clientKey'>, list: BowlingEntry[]) => blankBowlingEntry(side, player, list.length + 1, hasDismissals)
  const addBowlerByKey = (key: string) => {
    const player = byKey.get(key)
    if (player && !bowlingIds.has(key)) commit(setBowling(scorecard, side, [...rows, rowFor(player, rows)]))
  }
  const bowlerFor = (identity: Parameters<typeof addPlayer>[2]) => {
    const added = addPlayer(scorecard, side, identity, newRowFill(battingOf(scorecard, side), ownWickets).howOut)
    const player = added.scorecard.players.find((candidate) => playerRowKey(candidate) === added.key)
    const current = bowlingOf(added.scorecard, side)
    if (!player || current.some((entry) => entryPlayerKey(entry) === added.key)) {
      commit(added.scorecard)
      return
    }
    commit(setBowling(added.scorecard, side, [...current, rowFor(player, current)]))
  }
  const bowlersFromPaste = (names: string[]) => {
    let next = scorecard
    for (const name of names) {
      const added = addPlayer(next, side, support.nameIdentity(name), newRowFill(battingOf(next, side), ownWickets).howOut)
      const player = added.scorecard.players.find((candidate) => playerRowKey(candidate) === added.key)
      const current = bowlingOf(added.scorecard, side)
      next = player && !current.some((entry) => entryPlayerKey(entry) === added.key) ? setBowling(added.scorecard, side, [...current, rowFor(player, current)]) : added.scorecard
    }
    commit(next)
  }

  const support = useAddPlayerSupport({ clubId, matchId: match.id, seasonId: match.seasonId, side, ours, scorecard, prefillSide, label })
  // The side's own players who are not bowling yet come first, then the squad / earlier names the support offers.
  const bowlerOptions = [
    ...players
      .filter((player) => !player.substitute && !bowlingIds.has(playerRowKey(player)))
      .map((player) => ({ key: `b:${playerRowKey(player)}`, label: label(scorecardPersonName(player)), hint: 'On the team' })),
    ...support.options,
  ]

  const actions = usePlayerActions({
    clubId,
    seasonId: match.seasonId,
    leagueId: match.leagueId,
    ours: { side, teamId: ours?.teamId ?? null },
    scorecard,
    onScorecard: commit,
    ids,
    positionLabel: 'Bowling position',
    view,
    onReorder,
    menuSwap: false,
    menuLink: false,
    removeLabel: 'Remove bowler',
    removeDescription: (name) => `${name} comes off the bowling list. They stay on the team and any fielding credits stay.`,
    onRemove: (key) => commit(setBowling(scorecard, side, rows.filter((entry) => entryPlayerKey(entry) !== key))),
    disabled,
  })

  // docs/specs/104: the Guess chips of an imported draft, on the bowler rows and the fielding list.
  const guesses = useGuessActions({ clubId, seasonId: match.seasonId, leagueId: match.leagueId, oursSides, prefill, scorecard, onScorecard: commit })

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
  const notCharged = n(against?.byes) + n(against?.legByes) + n(against?.penaltyRuns)
  const hasBreakdown = against != null && [against.wides, against.noBalls, against.byes, against.legByes, against.penaltyRuns].some((v) => v != null)
  // With batting entries for the innings the wickets not credited to a bowler come from the dismissals.
  const derivedNonBowler = derivedNonBowlerWickets(scorecard, batted)
  const nonBowler = derivedNonBowler ?? n(against?.nonBowlerWickets)

  const ballsTone = against?.balls == null ? 'neutral' : balls === against.balls ? 'ok' : balls > against.balls ? 'warning' : 'neutral'
  const runsTone =
    against?.runs == null
      ? 'neutral'
      : hasBreakdown
        ? bowlerRuns + notCharged === against.runs
          ? 'ok'
          : 'warning'
        : bowlerRuns <= against.runs
          ? 'neutral'
          : 'warning'
  const wicketsTone =
    against?.wickets == null ? 'neutral' : bowlerWickets + nonBowler === against.wickets ? 'ok' : bowlerWickets + nonBowler > against.wickets ? 'warning' : 'neutral'

  const incomplete = Object.fromEntries(sides.map((candidate) => [candidate.side, stepIncomplete(draft, candidate.side, 'bowling')]))
  const notice = ours ? ourTeamNotice(prefillSide, scorecard, side, prefillState === 'ready') : null

  // ---- what the dismissals say ----
  const saysWickets = (key: string): number | null => {
    if (!hasDismissals) return null
    const wickets = creditFor(scorecard, batted, key).wickets
    return wickets > 0 ? wickets : null
  }
  // Typed rows that the dismissals disagree with: the bulk "Use the dismissals for all" offer.
  const typedDiffering =
    hasDismissals &&
    (rows.some((entry) => entry.wicketsSource !== 'DERIVED' && (saysWickets(entryPlayerKey(entry) as string) ?? n(entry.wickets)) !== n(entry.wickets)) ||
      fieldingOf(scorecard, side).some((entry) => {
        if (entry.creditsSource === 'DERIVED') return false
        const credit = creditFor(scorecard, batted, entryPlayerKey(entry) as string)
        return credit.catches + credit.stumpings + credit.runOuts > 0 && (credit.catches !== n(entry.catches) || credit.stumpings !== n(entry.stumpings) || credit.runOuts !== n(entry.runOuts))
      }))

  // ---- the grid ----
  const numberColumn = (field: 'maidens' | 'runs' | 'wides' | 'noBalls' | 'dots', header: string, name: string): ScorecardGridColumn<BowlingEntry> => ({
    id: field,
    header,
    align: 'right',
    width: 76,
    render: (entry) => {
      const key = entryPlayerKey(entry) as string
      return (
        <GridNumberInput
          value={entry[field] ?? null}
          onChange={(value) => edit(key, { [field]: value })}
          ariaLabel={`${name}, ${label(person(key))}`}
          column={field}
          max={field === 'dots' && entry.balls != null ? entry.balls : undefined}
          disabled={disabled}
        />
      )
    },
  })

  const wicketsCell = (entry: BowlingEntry, stepper = false) => {
    const key = entryPlayerKey(entry) as string
    const derived = entry.wicketsSource === 'DERIVED'
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: stepper ? 'flex-start' : 'flex-end', gap: 0.25 }}>
        <GridNumberInput
          stepper={stepper}
          value={entry.wickets}
          onChange={(value) => edit(key, { wickets: value, wicketsSource: 'MANUAL' })}
          ariaLabel={`Wickets, ${label(person(key))}`}
          column="wickets"
          disabled={disabled}
        />
        <DerivedMarker
          derived={derived}
          dismissalsSay={saysWickets(key)}
          current={n(entry.wickets)}
          subject={`wickets of ${label(person(key))}`}
          disabled={disabled}
          onUse={() => commit(followDismissals(scorecard, batted, key, 'bowling'))}
        />
      </Box>
    )
  }

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
            warn={entry.balls == null}
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
    { id: 'wickets', header: 'Wickets', align: 'right', width: 96, render: (entry) => wicketsCell(entry) },
    numberColumn('wides', 'Wides', 'Wides'),
    numberColumn('noBalls', 'No-balls', 'No-balls'),
    numberColumn('dots', 'Dots', 'Dot balls'),
  ]

  // The opposition has no standouts: no star on its rows.
  const star = (entry: BowlingEntry) => {
    if (!ours || !canFeatureBowler(entry)) return null
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
    const player = byKey.get(key)
    return (
      <ScorecardPlayerCell
        person={person(key)}
        view={view}
        guest={Boolean(player) && !player?.playerProfileId && !player?.opposition}
        duplicate={duplicates.has(key)}
        caption={captionOf(key)}
        onOpen={(anchor) => actions.openMenu(key, anchor)}
        disabled={disabled}
        guess={guesses.guessOf(player)}
      />
    )
  }

  // Fielding: only players with a credit row (derived from the dismissals, or added by the manager).
  const fieldingByKey = new Map(fieldingOf(scorecard, side).map((entry) => [entryPlayerKey(entry), entry]))
  const fielders = fieldingOf(scorecard, side).map((entry) => byKey.get(entryPlayerKey(entry) as string)).filter((player): player is ResultPlayer => Boolean(player))
  const fielderOptions = [
    ...players
      .filter((player) => !fieldingByKey.has(playerRowKey(player)))
      .map((player) => ({ key: `f:${playerRowKey(player)}`, label: label(scorecardPersonName(player)), hint: 'On the team' })),
    ...support.options,
  ]
  const fielderFor = (identity: Parameters<typeof addPlayer>[2], from: Scorecard = scorecard): Scorecard => {
    const added = addPlayer(from, side, identity, newRowFill().howOut)
    const player = added.scorecard.players.find((candidate) => playerRowKey(candidate) === added.key)
    return player ? addFielder(added.scorecard, side, player) : added.scorecard
  }

  const fieldingMarker = (player: ResultPlayer, entry: FieldingEntry | undefined, name: string) => {
    if (!hasDismissals) return null
    const key = playerRowKey(player)
    const credit = creditFor(scorecard, batted, key)
    const says = credit.catches + credit.stumpings + credit.runOuts
    if (!entry || entry.creditsSource === 'DERIVED' || says === 0) return null
    const differs = credit.catches !== n(entry.catches) || credit.stumpings !== n(entry.stumpings) || credit.runOuts !== n(entry.runOuts)
    if (!differs) return null
    const parts = [
      [credit.catches, 'catches'],
      [credit.stumpings, 'stumpings'],
      [credit.runOuts, 'run-outs'],
    ]
      .filter(([count]) => (count as number) > 0)
      .map(([count, word]) => `${count} ${word}`)
      .join(', ')
    return (
      <Button variant="ghost" size="compact" onClick={() => commit(followDismissals(scorecard, batted, key, 'fielding'))} disabled={disabled} aria-label={`Use the dismissals, fielding of ${name}`} title={`The dismissals say ${parts}`}>
        Use dismissals
      </Button>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <ScorecardStepHeader sides={sides} scorecardSide={side} onSideChange={onScorecardSideChange} incomplete={incomplete} ariaLabel="Team bowling" />
      <FormSectionHeading icon={<SportsBaseballOutlinedIcon />} title={`${teamName} bowling`} />
      {notice && <NotSelectedBanner notice={notice} onOpenTeams={onGoToStep ? () => onGoToStep('teams', side) : undefined} disabled={disabled} />}
      <InningsHintBanner />

      {!against ? null : !battingOrderKnown ? (
        <BattingOrderPrompt sides={sides} onChoose={(first) => onBattingOrder?.(first)} disabled={disabled} />
      ) : (
        <>
          <InningsSummaryCard
            teamName={battingName}
            title={battingName}
            innings={against}
            ballsPerOver={ballsPerOver}
            calculated={inningsSuggestions(draft).get(against.sequence ?? 2)}
            warning={against.balls != null && balls > 0 && against.balls !== balls ? 'Overs differ from the bowlers\' balls' : null}
            onEdit={(field, value) => onReplace(editInningsFigure(draft, against.sequence ?? 2, field, value))}
            onUseCalculated={(field) => onReplace(applyCalculatedFigure(draft, against.sequence ?? 2, field))}
            disabled={disabled}
          />
          {/* The card says when the figures are calculated; a strip appears only where the bowling does not add up. */}
          {(ballsTone === 'warning' || runsTone === 'warning' || wicketsTone === 'warning') && (
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
              {ballsTone === 'warning' && (
                <ReconcileStrip
                  tone={ballsTone}
                  title={against.balls === null ? `Balls ${balls}` : `Balls ${balls} of ${against.balls}`}
                  status={
                    against.balls === null
                      ? undefined
                      : balls === against.balls
                        ? 'all bowled'
                        : balls > against.balls
                          ? `${balls - against.balls} too many`
                          : `${against.balls - balls} left`
                  }
                  detail={against.balls === null ? undefined : `${ballsToOvers(balls, ballsPerOver)} of ${ballsToOvers(against.balls, ballsPerOver)} overs`}
                />
              )}
              {runsTone === 'warning' && (
                <ReconcileStrip
                  tone={runsTone}
                  title={against.runs === null ? `Runs ${bowlerRuns + notCharged} conceded` : `Runs ${bowlerRuns + notCharged} of ${against.runs} conceded`}
                  status={against.runs === null ? undefined : hasBreakdown ? (bowlerRuns + notCharged === against.runs ? 'adds up' : `${Math.abs(bowlerRuns + notCharged - against.runs)} ${bowlerRuns + notCharged > against.runs ? 'too many' : 'short'}`) : 'enter the extras to check the total'}
                  detail={`${bowlerRuns} charged to bowlers + ${notCharged} byes, leg byes and penalty`}
                />
              )}
              {wicketsTone === 'warning' && (
                <ReconcileStrip
                  tone={wicketsTone}
                  title={against.wickets === null ? `Wickets ${bowlerWickets} + ${nonBowler}` : `Wickets ${bowlerWickets} + ${nonBowler} = ${bowlerWickets + nonBowler} of ${against.wickets}`}
                  status={against.wickets === null ? undefined : bowlerWickets + nonBowler === against.wickets ? 'adds up' : undefined}
                  detail="Bowlers' wickets + wickets not credited to a bowler"
                />
              )}
            </Box>
          )}

          {typedDiffering && (
            <Alert
              severity="info"
              data-testid="typed-differs-banner"
              action={
                <Button variant="secondary" size="compact" onClick={() => setBulkOpen(true)} disabled={disabled}>
                  Use the dismissals for all
                </Button>
              }
            >
              Bowling and fielding figures were typed in, and the dismissals on {battingName}&apos;s batting card say otherwise.
            </Alert>
          )}

          {/* The batting side's extras sit above the rows so they stay put as bowlers are added. */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-start', gap: 1.5, mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Extras conceded by {teamName}
                <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 400, textTransform: 'none', letterSpacing: 0, ml: 0.5 }}>
                  (to {battingName})
                </Typography>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                Total {extrasTotal(against)}
              </Typography>
            </Box>
            <ExtrasFields
              hideTotal
              flagged={(key) => (key === 'wides' || key === 'noBalls') && (() => { const calc = inningsSuggestions(draft).get(against.sequence ?? 2)?.[key]; return calc != null && figureCorrected(against, key, calc) })()}
              value={against}
              owner={battingName}
              disabled={disabled}
              onChange={(patch) => {
                // Wides and no-balls are derived from the bowlers: typing one is an edit (with Reset); the rest are plain inputs.
                let next = draft
                for (const [key, value] of Object.entries(patch) as Array<[keyof Innings, number | null]>) {
                  next = key === 'wides' || key === 'noBalls' ? editInningsFigure(next, against.sequence ?? 2, key, value) : updateInnings(next, against.sequence ?? 2, { [key]: value })
                }
                onReplace(syncInningsFromScorecard(next))
              }}
              fieldNote={(key) => {
                if (key !== 'wides' && key !== 'noBalls') return null
                const calc = inningsSuggestions(draft).get(against.sequence ?? 2)?.[key]
                if (calc == null || !figureCorrected(against, key, calc)) return null
                return (
                  <CorrectedChip
                    label={`${key === 'wides' ? 'wides' : 'no-balls'}, ${battingName}`}
                    calculatedText={String(calc)}
                    onReset={() => onReplace(applyCalculatedFigure(draft, against.sequence ?? 2, key))}
                    disabled={disabled}
                  />
                )
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
              <Typography component="label" htmlFor={nonBowlerId} variant="body2" sx={{ fontWeight: 600 }}>
                Wickets not credited to a bowler
              </Typography>
              {derivedNonBowler !== null ? (
                <Typography id={nonBowlerId} variant="body2" sx={{ fontWeight: 700 }}>
                  {derivedNonBowler} <Typography component="span" variant="caption" color="text.secondary">(from the {battingName} batting card)</Typography>
                </Typography>
              ) : (
                <GridNumberInput
                  id={nonBowlerId}
                  value={against.nonBowlerWickets ?? null}
                  onChange={(value) => onReplace(syncInningsFromScorecard(updateInnings(draft, against.sequence ?? 2, { nonBowlerWickets: value })))}
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
            ariaLabel={`${teamName} bowling`}
            playerHeader="Bowler"
            rows={rows}
            getRowId={(entry) => entryPlayerKey(entry) as string}
            columns={columns}
            renderPlayer={playerCell}
            renderTrailing={star}
            trailingHeader={<StandoutHeader />}
            reorder={reorder}
            reorderDisabled={disabled}
            emptyMessage=""
            isRowFlagged={(entry) => guesses.guessOf(byKey.get(entryPlayerKey(entry) as string)) !== undefined}
            rowProblem={(entry) =>
              bowlingRowProblem(entry, {
                ballsPerOver,
                dismissalWickets: wicketsFullyAttributed(dismissalsOf(scorecard, batted)) ? creditFor(scorecard, batted, entryPlayerKey(entry) as string).wickets : null,
              })
            }
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
                  <OversInput label="Overs" warn={entry.balls == null} ariaLabel={`Overs, ${name}`} value={entry.balls} onChange={(value) => edit(key, { balls: value })} ballsPerOver={ballsPerOver} disabled={disabled} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, max-content))', gap: 1, justifyContent: 'space-between' }}>
                    {(
                      [
                        ['maidens', 'Maidens'],
                        ['runs', 'Runs conceded'],
                        ['wickets', 'Wickets'],
                        ['wides', 'Wides'],
                        ['noBalls', 'No-balls'],
                        ['dots', 'Dots'],
                      ] as const
                    ).map(([field, title]) => (
                      <Box key={field}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>
                          {title}
                        </Typography>
                        {field === 'wickets' ? (
                          wicketsCell(entry, true)
                        ) : (
                          <GridNumberInput
                            stepper
                            value={entry[field] ?? null}
                            onChange={(value) => edit(key, { [field]: value })}
                            ariaLabel={`${title === 'Dots' ? 'Dot balls' : title}, ${name}`}
                            column={field}
                            max={field === 'dots' && entry.balls != null ? entry.balls : undefined}
                            disabled={disabled}
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )
            }}
          />

          <AddPlayerRow
            label="Type a name to add a bowler"
            options={bowlerOptions}
            addLabel={support.addLabel}
            existingNames={players.map((player) => player.displayName ?? '')}
            onPick={(key) => {
              if (key.startsWith('b:')) {
                addBowlerByKey(key.slice(2))
                return
              }
              const identity = support.identityOf(key)
              if (identity) bowlerFor(identity)
            }}
            onAddName={(name) => bowlerFor(support.nameIdentity(name))}
            onAddNames={bowlersFromPaste}
            disabled={disabled}
          />
        </>
      )}

      <FormSectionHeading icon={<SportsHandballOutlinedIcon />} title={`${teamName} fielding`} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
        Credits appear when you name a fielder on the batting card. Add anyone who was missed; only players with a credit are saved.
      </Typography>
      <Box role="list" aria-label={`${teamName} fielding`} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', overflow: 'hidden' }}>
        {fielders.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No catches, stumpings or run-outs yet. Credits appear when you name a fielder on the batting card; add anyone missed.
          </Typography>
        )}
        {fielders.length > 0 && (
          <Box
            data-testid="fielding-header"
            sx={{ display: 'grid', gridTemplateColumns: FIELDING_GRID, alignItems: 'center', columnGap: 0.5, px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}
          >
            <Box />
            {FIELDING_FIELDS.map(({ field, label: title, short }) => (
              <Typography key={field} component="span" aria-hidden title={title} sx={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{title}</Box>
                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>{short}</Box>
              </Typography>
            ))}
            <Typography component="span" sx={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <StandoutHeader />
            </Typography>
          </Box>
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
                display: 'grid',
                gridTemplateColumns: FIELDING_GRID,
                alignItems: 'center',
                columnGap: 0.5,
                minHeight: 44,
                px: 1,
                py: 0.25,
                bgcolor: (theme) => (index % 2 === 1 ? theme.palette.action.hover : 'transparent'),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, pr: 0.5 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0, flex: '0 1 auto' }}>
                  <PlayerName person={scorecardPersonName(player)} view={view} />
                </Typography>
                {(() => {
                  const guess = guesses.guessOf(player)
                  return guess ? (
                    <GuessChip
                      importedName={guess.importedName}
                      level={guess.level}
                      matchedName={guess.matchedName}
                      reason={guess.reason}
                      onConfirm={guess.onConfirm}
                      onChange={guess.onChange}
                      guessKey={`${guess.key}:fielding`}
                      disabled={disabled}
                    />
                  ) : (
                    !player.playerProfileId && !player.opposition && <Chip size="small" label="Guest" sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.75rem' }} />
                  )
                })()}
                {(() => {
                  const guess = guesses.guessOf(player)
                  return guess?.onUseClosest && guess.closest ? <UseClosestButton guess={guess} disabled={disabled} /> : null
                })()}
                {(player.substitute || (player.playerProfileId && selectionSubstitutes.has(player.playerProfileId))) && (
                  <Chip size="small" label={ours ? '12th man' : 'Substitute'} sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.75rem' }} />
                )}
              </Box>
              {FIELDING_FIELDS.map(({ field, label: title }) => (
                <Counter key={field} label={`${title}, ${name}`} value={n(entry?.[field])} disabled={disabled} onChange={(delta) => commit(bumpFielding(scorecard, side, player, field, delta))} />
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {ours && entry && canFeatureFielder(entry) && (
                  <StandoutToggle
                    suggested={Boolean(entry.suggested)}
                    override={entry.featuredOverride}
                    onChange={(override) => commit(patchFielding(scorecard, key, { featuredOverride: override }))}
                    playerLabel={name}
                  />
                )}
              </Box>
              {fieldingMarker(player, entry, name) && <Box sx={{ gridColumn: '1 / -1' }}>{fieldingMarker(player, entry, name)}</Box>}
            </Box>
          )
        })}
      </Box>
      <AddPlayerRow
        label="Type a name to add a fielder"
        options={fielderOptions}
        addLabel={support.addLabel}
        existingNames={players.map((player) => player.displayName ?? '')}
        onPick={(key) => {
          if (key.startsWith('f:')) {
            const player = byKey.get(key.slice(2))
            if (player) commit(addFielder(scorecard, side, player))
            return
          }
          const identity = support.identityOf(key)
          if (identity) commit(fielderFor(identity))
        }}
        onAddName={(name) => commit(fielderFor(support.nameIdentity(name)))}
        onAddNames={(names) => commit(names.reduce((from, name) => fielderFor(support.nameIdentity(name), from), scorecard))}
        disabled={disabled}
      />
      {onGoToStep && (
        <Typography variant="body2" color="text.secondary">
          Not listed?{' '}
          <Button variant="ghost" size="compact" onClick={() => onGoToStep('teams', side)}>
            Add them on Teams
          </Button>
        </Typography>
      )}

      {actions.host}
      {guesses.host}

      <ConfirmDialog
        open={bulkOpen}
        title="Use the dismissals for all?"
        description="This replaces the typed bowling wickets and fielding catches, stumpings and run-outs with what the dismissals say. Figures you typed over will be overwritten."
        confirmLabel="Use the dismissals"
        onConfirm={() => {
          setBulkOpen(false)
          commit(followDismissals(scorecard, batted))
        }}
        onClose={() => setBulkOpen(false)}
      />
    </Box>
  )
}
