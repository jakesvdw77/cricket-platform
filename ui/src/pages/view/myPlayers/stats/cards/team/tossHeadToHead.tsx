import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { nOfM } from '../../statsFormat'
import { RESULT_LETTER, truncatedTeamNote } from '../../teamKit'

// docs/specs/147 Amendment 3, team.toss-head-to-head: the toss and the record against each opponent. Front: the tosses won and the wins
// against the opponents played most, as win-green bars. Back: head to head, each opponent as the manager recorded it with the results in date
// order. PARTLY: the toss is not always recorded. Source: tossWon, headToHead, basis.
const SHOWN_ROWS = 6
const FRONT_BARS = 3

export const teamTossHeadToHead: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.toss-head-to-head',
  page: 'team',
  group: 'squad',
  title: () => 'Toss And Head To Head',
  tag: 'PARTLY',
  needs: ['tossWon', 'headToHead', 'basis'],
  order: 30,
  whenMissing: 'hide',
  emptyText: 'No toss or opponents recorded yet.',
  basis: (p) => ({ counted: p.tossWon.known, total: p.tossWon.counted }),
  state: (p) => {
    if (p.tossWon.known === 0 && p.headToHead.length === 0) return 'empty'
    return p.tossWon.partly ? 'partial' : 'ready'
  },
  partialNote: (p) => `The toss is recorded in ${p.tossWon.known} of ${p.tossWon.counted} results.`,
  summary: (p) => `${p.teamName} won ${p.tossWon.won === null ? 'no recorded' : nOfM(p.tossWon.won, p.tossWon.known)} tosses and played ${p.headToHead.length} opponents.`,
  Front: ({ payload: p }) => {
    const opponents = p.headToHead.slice(0, FRONT_BARS)
    return (
      <>
        <Big value={p.tossWon.won === null ? '–' : nOfM(p.tossWon.won, p.tossWon.known)} caption="tosses won" />
        {opponents.length > 0 ? (
          <HorizontalBars
            alt={`${p.teamName}'s wins against each opponent: ${opponents.map((row) => `${row.opponentName ?? 'Opponent not recorded'} ${nOfM(row.won, row.played)}`).join(', ')}.`}
            rows={opponents.map((row, index) => ({ key: `${row.opponentName ?? 'none'}-${index}`, label: row.opponentName ?? 'Opponent not recorded', colour: STATS_COLOUR.good, value: row.won, valueLabel: nOfM(row.won, row.played) }))}
          />
        ) : (
          <Note>No opponents recorded yet.</Note>
        )}
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
