import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { ResultScoreLine } from '../../../components/ResultScoreLine'
import type { Match } from '../../../api/matchApi'
import type { Innings, MatchResult } from '../../../api/matchResultApi'
import type { Team } from '../../../api/teamApi'
import { ballsToOvers } from '../../../utils/oversFormat'
import { inningsFor, resultLine } from '../../../utils/resultLine'
import { ownSidesOf, resultSides, tossLine } from './resultListHelpers'
import { ResultScorecard } from './ResultScorecard'
import { NotRecordedValue } from './NotRecorded'
import { ResultStandouts } from './ResultStandouts'
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
      <KeyFigures result={result} names={names} />

      <ResultSection title="Details">
        <Details result={result} toss={toss} field={field}>
          {result.hasScorecard && <ResultStandouts clubId={clubId} match={match} ours={ownSidesOf(match, teamsById)} names={names} />}
        </Details>
      </ResultSection>

      {/* docs/specs/138: one Scorecard card holds the innings summary and, when there is a scorecard, the name toggle and the batting and bowling. */}
      {!result.hasScorecard && (
        <ResultSection title="Scorecard">
          <InningsTable result={result} names={names} />
        </ResultSection>
      )}

      {result.hasScorecard && (
        <ResultScorecard toss={toss} summary={<InningsTable result={result} names={names} />} clubId={clubId} match={match} result={result} names={names} ours={ownSidesOf(match, teamsById)} 
          readOnly={readOnly}
          sectionIds={{ home: match.homeTeamId ? teamsById.get(match.homeTeamId)?.sectionId : null, away: match.awayTeamId ? teamsById.get(match.awayTeamId)?.sectionId : null }}
        />
      )}

    </>
  )
}

interface Names {
  home: string
  away: string
}

// docs/specs/138 (owner, 2026-11-05): three compact counters, the Result first (who won and by how much, as the sentence), then the
// two scores. The toss is not a figure: it is in the Details section.
function KeyFigures({ result, names }: { result: MatchResult; names: Names }) {
  const scoreFor = (side: 'HOME' | 'AWAY') => (
    <ResultScoreLine innings={inningsFor(result.innings, side)} ballsPerOver={result.ballsPerOver} />
  )
  const line = result.outcomeType ? resultLine(result, names) : 'Result not entered yet'
  return (
    <Box
      data-testid="result-key-figures"
      sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}
    >
      <KeyFigureTile testId="result-figure-result" value={line} label="Result" textValue counter />
      <KeyFigureTile testId="result-figure-home" value={scoreFor('HOME')} label={names.home} textValue counter />
      <KeyFigureTile testId="result-figure-away" value={scoreFor('AWAY')} label={names.away} textValue counter />
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
  // docs/specs/138 (owner, 2026-11-05): the figures are bold, the column names are not.
  const statSx = { fontWeight: 700, fontSize: '1rem' } as const
  const extrasSx = { display: { xs: 'none', sm: 'block' } } as const
  return (
    <Box role="table" aria-label="Innings" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'clip' }}>
      <Box
        role="row"
        sx={{ ...rowSx, minHeight: 36, bgcolor: 'action.hover', fontSize: '0.75rem', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}
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
              <Typography variant="body1" fontWeight={600} noWrap>
                {batting}
              </Typography>
              {/* docs/specs/138 (owner, 2026-11-05): the rows are in batting order, so no "Innings 1" label; only a super over says what it is. */}
              {innings.kind === 'SUPER_OVER' && (
                <Typography variant="caption" component="div" color="text.secondary">
                  {inningsLabel(innings, regular, superOvers)}
                </Typography>
              )}
            </Box>
            <Box role="cell" sx={statSx}>{dash(innings.runs)}</Box>
            <Box role="cell" sx={statSx}>{dash(innings.wickets)}</Box>
            <Box role="cell" sx={statSx}>{ballsToOvers(innings.balls, result.ballsPerOver) || '–'}</Box>
            <Box role="cell" sx={[extrasSx, statSx]}>{dash(innings.extras)}</Box>
          </Box>
        )
      })}
    </Box>
  )
}

function DetailRow({ label, value, ruled }: { label: string; value: ReactNode; ruled: { xs: boolean; md: boolean } }) {
  const empty = value === NOT_RECORDED
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 2,
        py: 1.25,
        // Width and style only: the shorthand inside a breakpoint would reset the divider colour to the text colour.
        borderBottomStyle: 'solid',
        borderBottomWidth: { xs: ruled.xs ? 1 : 0, md: ruled.md ? 1 : 0 },
        borderBottomColor: 'divider',
      }}
    >
      {/* docs/specs/138 (owner, 2026-11-05): no icons on the rows (not every field has one); a value not recorded highlights its label text instead. */}
      <Typography variant="body2" color={empty ? 'warning.dark' : 'text.secondary'} fontWeight={empty ? 700 : undefined} sx={{ flex: 'none' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', overflowWrap: 'anywhere', color: 'text.primary' }}>
        {empty ? <NotRecordedValue testId="result-not-recorded" /> : value}
      </Typography>
    </Box>
  )
}

function Details({ result, toss, field, children }: { result: MatchResult; toss: string | null; field: string | null | undefined; children?: ReactNode }) {
  const dls = result.decidedBy === 'DLS'
  const rows: Array<[string, ReactNode]> = [
    ['Outcome', result.outcomeType ? OUTCOME_LABEL[result.outcomeType] : NOT_RECORDED],
    ['Decided by', DECIDED_BY_LABEL[result.decidedBy] ?? result.decidedBy],
    ...(dls ? ([['DLS target', result.dlsTarget ?? NOT_RECORDED]] as Array<[string, ReactNode]>) : []),
    ...(dls ? ([['DLS revised overs', result.dlsRevisedBalls ? ballsToOvers(result.dlsRevisedBalls, result.ballsPerOver) : NOT_RECORDED]] as Array<[string, ReactNode]>) : []),
    ['Toss', toss ?? NOT_RECORDED],
    ['Field', field ?? NOT_RECORDED],
    ['Scheduled overs', result.scheduledBalls ? ballsToOvers(result.scheduledBalls, result.ballsPerOver) : NOT_RECORDED],
    ['Note', result.note?.trim() ? result.note : NOT_RECORDED],
  ]
  // The last grid row draws no rule of its own (a half line under one column was drawn twice with the Standouts line): the Standouts block
  // below draws the one full-width line.
  const n = rows.length
  return (
    <Box data-testid="result-details" sx={{ display: 'grid', columnGap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      {rows.map(([label, value], index) => (
        <DetailRow key={label} label={label} value={value} ruled={{ xs: index < n - 1, md: index < n - (n % 2 === 0 ? 2 : 1) }} />
      ))}
      {children}
    </Box>
  )
}
