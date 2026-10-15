import { useEffect } from 'react'
import { Avatar, Box, ToggleButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined'
import { Button } from '../../../../components/Button'
import { CompactToggleGroup } from '../../../../components/CompactToggleGroup'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { CountField, RunsField, WicketsField } from '../../../../components/IntegerField'
import { OversInput } from '../../../../components/OversInput'
import { checkMargin } from '../../../../utils/marginCheck'
import { SidePicker } from '../../../../components/SidePicker'
import type { Innings, ResultMarginType } from '../../../../api/matchResultApi'
import { ballsToOvers } from '../../../../utils/oversFormat'
import {
  addSuperOver,
  applyBattingOrder,
  applySuggestion,
  firstBatterFromToss,
  hasRegularFigures,
  regularInningsOf,
  removeLastSuperOver,
  superOversOf,
  updateInnings,
} from '../resultDraftHelpers'
import { tossLine } from '../resultListHelpers'
import { calculatedMargin, marginCorrected } from '../calculatedMargin'
import { CorrectedChip } from '../scorecard/CorrectedChip'
import { applyCalculatedFigure, editInningsFigure, figureCorrected, inningsSuggestions, syncInningsFromScorecard } from '../scorecardDraft'
import type { InningsSuggestion } from '../scorecardDraft'
import { sidePickerOptions } from './sidePickerOptions'
import { SuggestedResultLine } from './SuggestedResultLine'
import type { StepProps } from './stepTypes'

const labelSx = { fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 } as const
const MAX_WICKETS = 10
const MAX_SUPER_OVER_WICKETS = 2

function runRate(innings: Innings, ballsPerOver: number): string | null {
  if (innings.runs === null || innings.balls === null || innings.balls <= 0) return null
  return (innings.runs / (innings.balls / ballsPerOver)).toFixed(2)
}

interface InningsRowProps {
  innings: Innings
  title: string
  name: string
  initials: string
  logoSrc?: string | null
  ballsPerOver: number
  maxWickets: number
  disabled?: boolean
  // What the scorecard adds up to for this innings (docs/specs/101): the figures follow it unless the manager edited them.
  suggestion?: InningsSuggestion
  onChange: (patch: Partial<Innings>) => void
  onReset: (field: 'runs' | 'wickets' | 'balls') => void
}

function InningsRow({ innings, title, name, initials, logoSrc, ballsPerOver, maxWickets, disabled, suggestion, onChange, onReset }: InningsRowProps) {
  const calcOf = (field: 'runs' | 'wickets' | 'balls') => suggestion?.[field] ?? null
  const corrected = (field: 'runs' | 'wickets' | 'balls') => figureCorrected(innings, field, calcOf(field))
  // A figure that follows the scorecard says so under the field.
  const auto = (field: 'runs' | 'wickets' | 'balls') =>
    calcOf(field) !== null && innings[field] !== null && !corrected(field) && innings[`${field}Corrected` as const] === false
  const chips = (['runs', 'wickets', 'balls'] as const).filter(corrected)
  return (
    <Box data-testid="innings-row" sx={{ py: 1.5, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
        <Avatar
          src={logoSrc ?? undefined}
          alt=""
          aria-hidden
          sx={{ width: 28, height: 28, fontSize: '0.7rem', fontWeight: 600, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14), color: 'primary.dark' }}
        >
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: '120px 120px 180px' }, gap: 1.25 }}>
        <RunsField
          label="Runs"
          ariaLabel={`${name} ${title} runs`}
          value={innings.runs}
          onChange={(runs) => onChange({ runs })}
          disabled={disabled}
          helperText={auto('runs') ? 'Calculated from the scorecard' : undefined}
        />
        <WicketsField
          label="Wickets"
          ariaLabel={`${name} ${title} wickets`}
          max={maxWickets}
          value={innings.wickets}
          onChange={(wickets) => onChange({ wickets })}
          disabled={disabled}
          helperText={auto('wickets') ? 'Calculated from the scorecard' : undefined}
        />
        <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
          <OversInput
            label="Overs"
            value={innings.balls ?? null}
            onChange={(balls) => onChange({ balls })}
            ballsPerOver={ballsPerOver}
            disabled={disabled}
            helperText={auto('balls') ? 'Calculated from the scorecard' : undefined}
          />
        </Box>
      </Box>
      {chips.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }} data-testid="innings-corrected">
          {chips.map((field) => (
            <CorrectedChip
              key={field}
              label={`${name} ${title} ${field}`}
              calculatedText={field === 'balls' ? `${ballsToOvers(calcOf(field), ballsPerOver)} overs` : `${field === 'runs' ? 'runs ' : 'wickets '}${calcOf(field)}`}
              onReset={() => onReset(field)}
              disabled={disabled}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

const ordinal = (n: number) => (n === 1 ? '1st innings' : '2nd innings')

// docs/specs/100-match-results-core.md, step 3 "Scores": a row per innings (runs, wickets, overs as "36.4"), the run
// rates read-only, and any number of super over pairs.
export function ScoresStep({ draft, onChange, onReplace, sides, disabled, onGoToStep, battingOrderKnown, onBattingOrder }: StepProps) {
  const ballsPerOver = draft.ballsPerOver ?? 6
  // Figures the scorecard can give but that are still empty (a loaded draft) fill in on arrival, with no click.
  useEffect(() => {
    const synced = syncInningsFromScorecard(draft)
    if (synced !== draft) onReplace(synced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The toss fixes the batting order. Without one, the manager says who batted first (kept once chosen, or once scores
  // already exist for a loaded draft).
  const tossFirst = firstBatterFromToss(draft)
  const orderKnown = battingOrderKnown ?? (tossFirst !== null || hasRegularFigures(draft))
  const suggestions = inningsSuggestions(draft)
  const won = draft.outcomeType === 'WON'
  const decidedBy = draft.decidedBy ?? 'REGULAR'
  const toss = tossLine({ tossWonBy: draft.tossWonBy ?? null, tossDecision: draft.tossDecision ?? null }, { home: sides[0].name, away: sides[1].name })
  const regular = regularInningsOf(draft)
  const names = { home: sides[0].name, away: sides[1].name }
  const check = checkMargin(draft, names)
  // "Use this" only corrects a decision (outcome, winner, how decided); the margin follows the scores by itself.
  const suggested = check.suggestion
  const winnerDiffers = suggested != null && (suggested.outcomeType !== draft.outcomeType || suggested.winningSide !== (draft.winningSide ?? null) || suggested.decidedBy !== (draft.decidedBy ?? 'REGULAR'))
  const calcMargin = calculatedMargin(draft, names)
  const marginIsEdited = marginCorrected(draft, names)
  // Super over panels belong to a win decided by one and nowhere else.
  const showSuperOvers = draft.outcomeType === 'WON' && draft.decidedBy === 'SUPER_OVER'
  const superOvers = showSuperOvers ? superOversOf(draft) : []
  const bySide = new Map(sides.map((side) => [side.side, side]))
  const optionalScores = draft.outcomeType === 'FORFEIT' || draft.outcomeType === 'ABANDONED' || draft.outcomeType === 'NO_RESULT'
  const rates = regular
    .map((innings) => ({ name: bySide.get(innings.battingSide ?? 'HOME')?.name ?? '', rate: runRate(innings, ballsPerOver) }))
    .filter((item) => item.rate)
  const scheduled = draft.scheduledBalls ? ballsToOvers(draft.scheduledBalls, ballsPerOver).replace(/\.0$/, '') : null

  // A figure typed here is the manager's (flagged corrected) so the scorecard does not overwrite it.
  const patch = (sequence: number) => (change: Partial<Innings>) => {
    let next = draft
    for (const [key, value] of Object.entries(change) as Array<[keyof Innings, number | null]>) {
      next = key === 'runs' || key === 'wickets' || key === 'balls' ? editInningsFigure(next, sequence, key, value) : updateInnings(next, sequence, { [key]: value })
    }
    onReplace(next)
  }
  const pairs: Innings[][] = []
  for (let index = 0; index < superOvers.length; index += 2) pairs.push(superOvers.slice(index, index + 2))

  const rowFor = (innings: Innings, title: string, maxWickets: number) => {
    const side = bySide.get(innings.battingSide ?? 'HOME') ?? sides[0]
    return (
      <InningsRow
        key={innings.sequence}
        innings={innings}
        title={title}
        name={side.name}
        initials={side.logo.initials}
        logoSrc={side.logo.src}
        ballsPerOver={ballsPerOver}
        maxWickets={maxWickets}
        disabled={disabled}
        suggestion={suggestions.get(innings.sequence ?? 0)}
        onChange={patch(innings.sequence ?? 0)}
        onReset={(field) => onReplace(applyCalculatedFigure(draft, innings.sequence ?? 0, field))}
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <FormSectionHeading icon={<SportsScoreOutlinedIcon />} title="Innings" />
      </Box>
      {tossFirst !== null ? (
        <Box data-testid="toss-context" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {toss}
          </Typography>
          {onGoToStep && (
            <Button variant="ghost" size="sm" onClick={() => onGoToStep('toss')} disabled={disabled}>
              Change toss
            </Button>
          )}
        </Box>
      ) : (
        <Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
            Who batted first?
          </Typography>
          <SidePicker
            label="Who batted first?"
            options={sidePickerOptions(sides)}
            value={orderKnown ? (regularInningsOf(draft)[0]?.battingSide ?? null) : null}
            onChange={(side) => {
              if (onBattingOrder) onBattingOrder(side)
              else onReplace(applyBattingOrder(draft, side))
            }}
            disabled={disabled}
          />
          {onGoToStep && (
            <Button variant="ghost" size="sm" onClick={() => onGoToStep('toss')} disabled={disabled} sx={{ mt: 0.5 }}>
              Record the toss instead
            </Button>
          )}
        </Box>
      )}
      {optionalScores && (
        <Typography variant="body2" color="text.secondary">
          Scores are optional for this result.
        </Typography>
      )}

      {orderKnown && <Box>{regular.map((innings) => rowFor(innings, ordinal(innings.sequence ?? 1), MAX_WICKETS))}</Box>}

      {rates.length > 0 && (
        <Typography variant="caption" color="text.secondary" data-testid="run-rates" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          Run rate: {rates.map((item) => `${item.name} ${item.rate}`).join(' · ')}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        36.4 means 36 overs and 4 balls{scheduled ? ` (the match has ${scheduled} overs)` : ''}; the ball after the point is 0 to {ballsPerOver - 1}.
      </Typography>

      {check.suggestion && (
        <Box sx={{ mt: 1 }}>
          <SuggestedResultLine check={check} names={names} canUse={winnerDiffers} onUse={() => onReplace(applySuggestion(draft, check.suggestion!))} disabled={disabled} />
        </Box>
      )}


      {won && decidedBy !== 'SUPER_OVER' && (
        <Box>
          <Typography sx={labelSx}>Margin</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Box sx={{ width: 120 }}>
              <CountField
                label="Margin"
                ariaLabel="Margin"
                value={draft.marginValue ?? null}
                onChange={(value) => onChange({ marginValue: value, marginType: draft.marginType ?? 'RUNS', marginCorrected: value !== null })}
                helperText={!marginIsEdited && calcMargin ? 'Calculated from the scores' : undefined}
                disabled={disabled}
              />
            </Box>
            <CompactToggleGroup<ResultMarginType>
              value={draft.marginType ?? 'RUNS'}
              onChange={(next) => onChange({ marginType: next, marginCorrected: true })}
              ariaLabel="Margin type"
            >
              <ToggleButton value="RUNS">Runs</ToggleButton>
              <ToggleButton value="WICKETS">Wickets</ToggleButton>
            </CompactToggleGroup>
          </Box>
          {marginIsEdited && calcMargin && (
            <Box sx={{ mt: 1 }}>
              <CorrectedChip
                label="margin"
                calculatedText={`${calcMargin.value} ${calcMargin.type === 'RUNS' ? (calcMargin.value === 1 ? 'run' : 'runs') : calcMargin.value === 1 ? 'wicket' : 'wickets'}`}
                onReset={() => onChange({ marginType: calcMargin.type, marginValue: calcMargin.value, marginCorrected: false })}
                disabled={disabled}
              />
            </Box>
          )}
        </Box>
      )}

      {pairs.map((pair, index) => (
        <Box key={pair[0]?.sequence} data-testid="super-over" sx={(theme) => ({ mt: 1, borderRadius: 1, bgcolor: alpha(theme.palette.purple.main, 0.07), px: 1.5, pb: 0.5 })}>
          <Typography variant="caption" sx={{ display: 'block', pt: 1, fontWeight: 700, color: 'purple.dark' }}>
            Super over {index + 1}
          </Typography>
          {pair.map((innings) => rowFor(innings, `Super over ${index + 1}`, MAX_SUPER_OVER_WICKETS))}
        </Box>
      ))}

      {showSuperOvers && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          <Button variant="secondary" size="sm" startIcon={<AddIcon />} onClick={() => onReplace(addSuperOver(draft))} disabled={disabled}>
            Add super over
          </Button>
          {pairs.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => onReplace(removeLastSuperOver(draft))} disabled={disabled}>
              Remove super over {pairs.length}
            </Button>
          )}
        </Box>
      )}
    </Box>
  )
}
