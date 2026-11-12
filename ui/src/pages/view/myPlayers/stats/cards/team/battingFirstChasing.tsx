import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ProgressBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Cap, FaceTable, Note, Split } from '../../cardParts'
import { DASH, formatCount, formatDecimal, nOfM, need } from '../../statsFormat'
import { matchLabel } from '../../teamKit'

// docs/specs/147 Amendment 3, team.batting-first-chasing: wins and the batting average when batting first and when chasing (a two-category
// comparison: green and blue). Back: the same as a table with the highest successful chase. Source: byInningsNumber, battingOrder, chasing.
export const teamBattingFirstChasing: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.batting-first-chasing',
  page: 'team',
  group: 'batting',
  title: () => 'Batting First v Chasing',
  tag: 'PARTLY',
  needs: ['byInningsNumber', 'battingOrder', 'chasing', 'basis'],
  order: 40,
  whenMissing: 'hide',
  emptyText: 'No results with the batting order recorded yet.',
  basis: (p) => ({ counted: p.battingOrder.recorded, total: p.battingOrder.counted }),
  state: (p) => {
    if (!p.byInningsNumber) return 'missing'
    if (p.byInningsNumber.first.played === 0 && p.byInningsNumber.chasing.played === 0) return 'empty'
    return p.battingOrder.recorded < p.battingOrder.counted ? 'partial' : 'ready'
  },
  partialNote: (p) => `The batting order is recorded in ${p.battingOrder.recorded} of ${p.battingOrder.counted} results.`,
  summary: (p) => `${p.teamName} won ${need(p.byInningsNumber).first.won} of ${need(p.byInningsNumber).first.played} batting first and ${need(p.byInningsNumber).chasing.won} of ${need(p.byInningsNumber).chasing.played} chasing.`,
  Front: ({ payload: p }) => {
    const { first, chasing } = need(p.byInningsNumber)
    return (
      <>
        <ProgressBars
          alt={`Wins when batting first: ${nOfM(first.won, first.played)}. Wins when chasing: ${nOfM(chasing.won, chasing.played)}.`}
          rows={[
            { key: 'first', label: 'Won batting first', tone: 'compare', seriesIndex: 0, value: first.won, target: first.played, text: nOfM(first.won, first.played) },
            { key: 'chasing', label: 'Won chasing', tone: 'compare', seriesIndex: 1, value: chasing.won, target: chasing.played, text: nOfM(chasing.won, chasing.played) },
          ]}
        />
        <Split
          columns={[
            { key: 'first', title: 'Batting first', swatch: STATS_COLOUR.compareFirst, rows: [{ key: 'avg', label: 'Average', value: formatDecimal(first.average, 1) }] },
            { key: 'chasing', title: 'Chasing', swatch: STATS_COLOUR.compareSecond, rows: [{ key: 'avg', label: 'Average', value: formatDecimal(chasing.average, 1) }] },
          ]}
        />
      </>
    )
  },
  Back: ({ payload: p }) => {
    const { first, chasing } = need(p.byInningsNumber)
    const chase = p.chasing.highestSuccessfulChase
    return (
      <>
        <Cap>Batting first and chasing</Cap>
        <FaceTable
          label="Batting first and chasing: matches, wins, innings, runs and average"
          heads={['Figure', 'First', 'Chasing']}
          rows={[
            { key: 'played', cells: ['Matches', String(first.played), String(chasing.played)] },
            { key: 'won', cells: ['Won', String(first.won), String(chasing.won)] },
            { key: 'innings', cells: ['Innings', String(first.innings), String(chasing.innings)] },
            { key: 'runs', cells: ['Runs', formatCount(first.runs), formatCount(chasing.runs)] },
            { key: 'avg', cells: ['Average', formatDecimal(first.average, 1), formatDecimal(chasing.average, 1)] },
            { key: 'chase', cells: ['Highest chase', DASH, chase ? String(chase.runs) : DASH] },
          ]}
        />
        {chase && <Note>Highest successful chase: {chase.runs} against a target of {chase.target} ({matchLabel(chase)}).</Note>}
      </>
    )
  },
}
