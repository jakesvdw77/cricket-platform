import { useState } from 'react'
import { Avatar, Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined'
import { Button } from '../../../../components/Button'
import { FormSectionHeading } from '../../../../components/FormSectionHeading'
import { Input } from '../../../../components/Input'
import { OversInput } from '../../../../components/OversInput'
import { checkMargin } from '../../../../utils/marginCheck'
import { SidePicker } from '../../../../components/SidePicker'
import type { Innings } from '../../../../api/matchResultApi'
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
import { sidePickerOptions } from './sidePickerOptions'
import { SuggestedResultLine } from './SuggestedResultLine'
import type { StepProps } from './stepTypes'

const MAX_WICKETS = 10
const MAX_SUPER_OVER_WICKETS = 2

function toInt(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 ? value : null
}

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
  onChange: (patch: Partial<Innings>) => void
}

function InningsRow({ innings, title, name, initials, logoSrc, ballsPerOver, maxWickets, disabled, onChange }: InningsRowProps) {
  const wicketsTooMany = innings.wickets !== null && innings.wickets > maxWickets
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
        <Input
          label="Runs"
          type="number"
          value={innings.runs ?? ''}
          onChange={(event) => onChange({ runs: toInt(event.target.value) })}
          disabled={disabled}
          inputProps={{ min: 0, inputMode: 'numeric', 'aria-label': `${name} ${title} runs` }}
        />
        <Input
          label="Wickets"
          type="number"
          value={innings.wickets ?? ''}
          onChange={(event) => onChange({ wickets: toInt(event.target.value) })}
          disabled={disabled}
          error={wicketsTooMany}
          helperText={wicketsTooMany ? `0 to ${maxWickets}` : undefined}
          inputProps={{ min: 0, max: maxWickets, inputMode: 'numeric', 'aria-label': `${name} ${title} wickets` }}
        />
        <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
          <OversInput
            label="Overs"
            value={innings.balls ?? null}
            onChange={(balls) => onChange({ balls })}
            ballsPerOver={ballsPerOver}
            disabled={disabled}
          />
        </Box>
      </Box>
    </Box>
  )
}

const ordinal = (n: number) => (n === 1 ? '1st innings' : '2nd innings')

// docs/specs/100-match-results-core.md, step 3 "Scores": a row per innings (runs, wickets, overs as "36.4"), the run
// rates read-only, and any number of super over pairs.
export function ScoresStep({ draft, onReplace, sides, disabled, onGoToStep, scorecardAvailable }: StepProps) {
  const ballsPerOver = draft.ballsPerOver ?? 6
  // The toss fixes the batting order. Without one, the manager says who batted first (kept once chosen, or once scores
  // already exist for a loaded draft).
  const tossFirst = firstBatterFromToss(draft)
  const [askedChoice, setAskedChoice] = useState(false)
  const orderKnown = tossFirst !== null || askedChoice || hasRegularFigures(draft)
  const toss = tossLine({ tossWonBy: draft.tossWonBy ?? null, tossDecision: draft.tossDecision ?? null }, { home: sides[0].name, away: sides[1].name })
  const regular = regularInningsOf(draft)
  const names = { home: sides[0].name, away: sides[1].name }
  const check = checkMargin(draft, names)
  // Super over panels belong to a win decided by one and nowhere else.
  const showSuperOvers = draft.outcomeType === 'WON' && draft.decidedBy === 'SUPER_OVER'
  const superOvers = showSuperOvers ? superOversOf(draft) : []
  const bySide = new Map(sides.map((side) => [side.side, side]))
  const optionalScores = draft.outcomeType === 'FORFEIT' || draft.outcomeType === 'ABANDONED' || draft.outcomeType === 'NO_RESULT'
  const rates = regular
    .map((innings) => ({ name: bySide.get(innings.battingSide ?? 'HOME')?.name ?? '', rate: runRate(innings, ballsPerOver) }))
    .filter((item) => item.rate)
  const scheduled = draft.scheduledBalls ? ballsToOvers(draft.scheduledBalls, ballsPerOver).replace(/\.0$/, '') : null

  const patch = (sequence: number) => (change: Partial<Innings>) => onReplace(updateInnings(draft, sequence, change))
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
        onChange={patch(innings.sequence ?? 0)}
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
              setAskedChoice(true)
              onReplace(applyBattingOrder(draft, side))
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
          <SuggestedResultLine check={check} names={names} onUse={() => onReplace(applySuggestion(draft, check.suggestion!))} disabled={disabled} />
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

      {scorecardAvailable && onGoToStep && (
        <Box
          data-testid="scorecard-prompt"
          sx={{ mt: 1.5, p: 1.5, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 220px' }}>
            Want to record who batted, bowled and fielded? It is optional.
          </Typography>
          <Button variant="secondary" size="sm" onClick={() => onGoToStep('our-batting')} disabled={disabled}>
            Add our scorecard
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onGoToStep('review')} disabled={disabled}>
            Skip to review
          </Button>
        </Box>
      )}

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
