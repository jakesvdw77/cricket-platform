import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ProgressBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { nOfM } from '../../statsFormat'
import { RESULT_LETTER, truncatedTeamNote } from '../../teamKit'

// docs/specs/147 section 5, team.first-chasing: wins when batting first and when chasing, with the toss. Back: head to head, each
// opponent as recorded by the manager with the results in date order. Source: battingOrder, tossWon, headToHead, basis.
const SHOWN_ROWS = 6

export const teamFirstChasing: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.first-chasing',
  page: 'team',
  group: 'matchups',
  title: () => 'Batting first v chasing',
  tag: 'PARTLY',
  needs: ['battingOrder', 'tossWon', 'headToHead', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No results with the batting order recorded yet.',
  basis: (p) => ({ counted: p.battingOrder.recorded, total: p.battingOrder.counted }),
  state: (p) => {
    if (p.battingOrder.recorded === 0 && p.tossWon.known === 0) return 'empty'
    return p.battingOrder.recorded < p.battingOrder.counted || p.tossWon.partly ? 'partial' : 'ready'
  },
  partialNote: (p) => `The batting order is recorded in ${p.battingOrder.recorded} of ${p.battingOrder.counted} results, the toss in ${p.tossWon.known} of ${p.tossWon.counted}.`,
  summary: (p) => `${p.teamName} won ${p.battingOrder.battingFirst.won} of ${p.battingOrder.battingFirst.played} batting first and ${p.battingOrder.chasing.won} of ${p.battingOrder.chasing.played} chasing.`,
  Front: ({ payload: p }) => {
    const { battingFirst, chasing } = p.battingOrder
    const toss = p.tossWon.won === null ? 'The toss is not recorded yet.' : `Toss won: ${nOfM(p.tossWon.won, p.tossWon.known)}.`
    return (
      <>
        <ProgressBars
          alt={`Wins when batting first: ${nOfM(battingFirst.won, battingFirst.played)}. Wins when chasing: ${nOfM(chasing.won, chasing.played)}.`}
          rows={[
            { key: 'first', label: 'Bat first', tone: 'compare', seriesIndex: 0, value: battingFirst.won, target: battingFirst.played, text: nOfM(battingFirst.won, battingFirst.played) },
            { key: 'chasing', label: 'Chasing', tone: 'compare', seriesIndex: 1, value: chasing.won, target: chasing.played, text: nOfM(chasing.won, chasing.played) },
          ]}
        />
        <Note>{toss}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const rows = p.headToHead.slice(0, SHOWN_ROWS)
    return (
      <>
        <Cap>Head to head</Cap>
        {rows.length > 0 ? (
          <FaceTable
            label="Results against each opponent, oldest first"
            heads={['Opponent', 'Won', 'Results']}
            rows={rows.map((row, index) => ({
              key: `${row.opponentName ?? 'none'}-${index}`,
              cells: [row.opponentName ?? 'Opponent not recorded', nOfM(row.won, row.played), row.results.map((meeting) => `${RESULT_LETTER[meeting.result]}${meeting.forfeit ? '*' : ''}`).join(' ')],
            }))}
          />
        ) : (
          <Note>No opponents recorded yet.</Note>
        )}
        {p.headToHead.length > SHOWN_ROWS && <Note>The first {SHOWN_ROWS} of {p.headToHead.length} opponents.</Note>}
        <Note>W won, L lost, T tied, D drawn, NR no result, * a forfeit. Oldest first.</Note>
        {p.basis.truncated && <Note>{truncatedTeamNote(p)}</Note>}
      </>
    )
  },
}
