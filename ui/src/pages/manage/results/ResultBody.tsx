import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { ResultScoreLine } from '../../../components/ResultScoreLine'
import type { Match } from '../../../api/matchApi'
import type { Innings, MatchResult } from '../../../api/matchResultApi'
import type { Team } from '../../../api/teamApi'
import { ballsToOvers } from '../../../utils/oversFormat'
import { inningsFor } from '../../../utils/resultLine'
import { ownSidesOf, resultSides, tossLine } from './resultListHelpers'
import { ResultScorecard } from './ResultScorecard'
import { ResultSection } from './ResultSection'

const NOT_RECORDED = 'Not recorded'

const OUTCOME_LABEL: Record<string, string> = {
  WON: 'Won',
  TIE: 'Tied',
  DRAW: 'Draw',
  NO_RESULT: 'No result',
  ABANDONED: 'Abandoned',
  FORFEIT: 'Forfeit',
}
const DECIDED_BY_LABEL: Record<string, string> = {
  REGULAR: 'Normal play',
  DLS: 'DLS method',
  SUPER_OVER: 'Super over',
}


// docs/specs/104-match-results-import-adaptors.md: everything on the result page under its header band, shared by
// ResultDetailPage and the capture wizard's "Preview result" dialog so the two cannot drift apart.
export function ResultBody({
  clubId,
  match,
  result,
  teamsById,
  readOnly = false,
}: {
  clubId: string
  match: Match
  result: MatchResult
  teamsById: Map<string, Team>
  // The preview: nothing in the body changes the result.
  readOnly?: boolean
}) {
  const [home, away] = resultSides(match, teamsById)
  const names = { home: home.name, away: away.name }
  const toss = tossLine(result, names)
  const field = result.playingAreaName ?? match.playingAreaName ?? match.venue
  return (
    <>
      <KeyFigures result={result} names={names} toss={toss} />

      <ResultSection title="Innings">
        <InningsTable result={result} names={names} />
      </ResultSection>

      {result.hasScorecard && (
        <ResultScorecard clubId={clubId} match={match} result={result} names={names} ours={ownSidesOf(match, teamsById)} toss={toss} readOnly={readOnly} />
      )}

      <ResultSection title="Details">
        <Details result={result} toss={toss} field={field} />
      </ResultSection>
    </>
  )
}

interface Names {
  home: string
  away: string
}

function KeyFigures({ result, names, toss }: { result: MatchResult; names: Names; toss: string | null }) {
  const scoreFor = (side: 'HOME' | 'AWAY') => (
    <ResultScoreLine innings={inningsFor(result.innings, side)} ballsPerOver={result.ballsPerOver} />
  )
  const margin =
    result.marginValue === null || !result.marginType
      ? '–'
      : `${result.marginValue} ${result.marginType === 'RUNS' ? 'runs' : 'wickets'}`
  const oversText = result.scheduledBalls ? ballsToOvers(result.scheduledBalls, result.ballsPerOver) : '–'
  return (
    <Box
      data-testid="result-key-figures"
      sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <KeyFigureTile
        testId="result-figure-home"
        icon={<ScoreboardOutlinedIcon />}
        value={scoreFor('HOME')}
        label={names.home}
        textValue
      />
      <KeyFigureTile
        testId="result-figure-away"
        icon={<ScoreboardOutlinedIcon />}
        value={scoreFor('AWAY')}
        label={names.away}
        textValue
      />
      <KeyFigureTile testId="result-figure-margin" icon={<EmojiEventsOutlinedIcon />} value={margin} label="Margin" textValue />
      <KeyFigureTile
        testId="result-figure-toss"
        icon={<SportsCricketOutlinedIcon />}
        value={toss ?? '–'}
        label={`Toss · ${oversText === '–' ? 'overs not set' : `${oversText} overs`}`}
        textValue
      />
    </Box>
  )
}

const TABLE_COLUMNS = { xs: 'minmax(0, 1fr) 64px 40px 64px', sm: 'minmax(0, 1.6fr) 90px 90px 90px 90px' }

function inningsLabel(innings: Innings, regularIndex: number, superIndex: number): string {
  return innings.kind === 'SUPER_OVER' ? `Super over ${superIndex}` : `Innings ${regularIndex}`
}

function InningsTable({ result, names }: { result: MatchResult; names: Names }) {
  const ordered = [...result.innings].sort((a, b) => {
    const kindOrder = (a.kind === 'SUPER_OVER' ? 1 : 0) - (b.kind === 'SUPER_OVER' ? 1 : 0)
    return kindOrder || (a.sequence ?? 0) - (b.sequence ?? 0)
  })
  if (ordered.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No scores entered.
      </Typography>
    )
  }
  let regular = 0
  let superOvers = 0
  const rowSx = {
    display: 'grid',
    gridTemplateColumns: TABLE_COLUMNS,
    columnGap: 1,
    alignItems: 'center',
    px: 1.5,
    minHeight: 44,
    fontVariantNumeric: 'tabular-nums',
  } as const
  const extrasSx = { display: { xs: 'none', sm: 'block' } } as const
  return (
    <Box role="table" aria-label="Innings" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'clip' }}>
      <Box
        role="row"
        sx={{ ...rowSx, minHeight: 36, bgcolor: 'action.hover', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}
      >
        <Box role="columnheader">Innings</Box>
        <Box role="columnheader">Runs</Box>
        <Box role="columnheader">Wkts</Box>
        <Box role="columnheader">Overs</Box>
        <Box role="columnheader" sx={extrasSx}>Extras</Box>
      </Box>
      {ordered.map((innings, index) => {
        if (innings.kind === 'SUPER_OVER') superOvers += 1
        else regular += 1
        const batting = innings.battingSide === 'HOME' ? names.home : innings.battingSide === 'AWAY' ? names.away : '–'
        const dash = (value: number | null | undefined) => (value === null || value === undefined ? '–' : value)
        return (
          <Box
            key={`${innings.sequence ?? index}-${innings.kind ?? 'REGULAR'}`}
            role="row"
            data-testid="innings-row"
            sx={{
              ...rowSx,
              ...(innings.kind === 'SUPER_OVER' ? { bgcolor: 'action.selected' } : index % 2 === 0 ? { bgcolor: 'action.hover' } : {}),
            }}
          >
            <Box role="cell" sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {batting}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {inningsLabel(innings, regular, superOvers)}
              </Typography>
            </Box>
            <Box role="cell">{dash(innings.runs)}</Box>
            <Box role="cell">{dash(innings.wickets)}</Box>
            <Box role="cell">{ballsToOvers(innings.balls, result.ballsPerOver) || '–'}</Box>
            <Box role="cell" sx={extrasSx}>{dash(innings.extras)}</Box>
          </Box>
        )
      })}
    </Box>
  )
}

function DetailRow({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  const empty = value === NOT_RECORDED
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 'none' }}>
        {icon}
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', overflowWrap: 'anywhere', color: empty ? 'text.secondary' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  )
}

function Details({ result, toss, field }: { result: MatchResult; toss: string | null; field: string | null | undefined }) {
  const dls = result.decidedBy === 'DLS'
  return (
    <Box data-testid="result-details" sx={{ display: 'grid', columnGap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <DetailRow label="Outcome" value={result.outcomeType ? OUTCOME_LABEL[result.outcomeType] : NOT_RECORDED} icon={<EmojiEventsOutlinedIcon fontSize="small" />} />
      <DetailRow label="Decided by" value={DECIDED_BY_LABEL[result.decidedBy] ?? result.decidedBy} />
      {dls && <DetailRow label="DLS target" value={result.dlsTarget ?? NOT_RECORDED} />}
      {dls && (
        <DetailRow
          label="DLS revised overs"
          value={result.dlsRevisedBalls ? ballsToOvers(result.dlsRevisedBalls, result.ballsPerOver) : NOT_RECORDED}
        />
      )}
      <DetailRow label="Toss" value={toss ?? NOT_RECORDED} icon={<SportsCricketOutlinedIcon fontSize="small" />} />
      <DetailRow label="Field" value={field ?? NOT_RECORDED} icon={<PlaceOutlinedIcon fontSize="small" />} />
      <DetailRow
        label="Scheduled overs"
        value={result.scheduledBalls ? ballsToOvers(result.scheduledBalls, result.ballsPerOver) : NOT_RECORDED}
        icon={<EventOutlinedIcon fontSize="small" />}
      />
      <DetailRow label="Note" value={result.note?.trim() ? result.note : NOT_RECORDED} />
    </Box>
  )
}
