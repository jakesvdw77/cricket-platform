import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis, truncatedNote } from '../../cardKit'
import { formatDecimal, scoreText } from '../../statsFormat'

// docs/specs/147 section 5, mine.innings-number: runs batting first and chasing (each bar a link to those innings). Back: the scores against
// each opposition, as the manager recorded the name. Source: byInningsNumber, byOpposition.
const OPPONENTS_SHOWN = 8

export const mineInningsNumber: StatsCardDef<MyStatsDto> = {
  id: 'mine.innings-number',
  page: 'mine',
  group: 'batting',
  title: () => 'First or chasing',
  tag: 'HAVE',
  needs: ['byInningsNumber', 'byOpposition', 'basis'],
  order: 50,
  whenMissing: 'hide',
  emptyText: 'Not enough innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    if (p.byInningsNumber.battingFirst.innings + p.byInningsNumber.chasing.innings === 0) return 'empty'
    return p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: truncatedNote,
  summary: (p, ctx) => `${ctx.firstName} has ${p.byInningsNumber.battingFirst.runs} runs batting first and ${p.byInningsNumber.chasing.runs} chasing.`,
  Front: ({ payload: p, ctx }) => {
    const first = p.byInningsNumber.battingFirst
    const chasing = p.byInningsNumber.chasing
    return (
      <>
        <HorizontalBars
          alt={`Runs by innings number: batting first ${first.runs}, chasing ${chasing.runs}.`}
          rows={[
            { key: 'first', label: 'Batting 1st', value: first.runs, valueLabel: String(first.runs), href: first.filter && first.innings > 0 ? ctx.drillHref({ kind: 'BATTING', filter: first.filter, label: 'Batting first' }) : undefined },
            { key: 'chasing', label: 'Chasing', value: chasing.runs, valueLabel: String(chasing.runs), href: chasing.filter && chasing.innings > 0 ? ctx.drillHref({ kind: 'BATTING', filter: chasing.filter, label: 'Chasing' }) : undefined },
          ]}
        />
        <Note>
          Average {formatDecimal(first.average)} batting first, {formatDecimal(chasing.average)} chasing. Tap a bar.
        </Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>By opposition</Cap>
      {p.byOpposition.length === 0 ? (
        <Note>No scores against a named opposition yet.</Note>
      ) : (
        <FaceTable
          label="Scores against each opposition"
          heads={['Against', 'Scores', 'Runs']}
          rows={p.byOpposition.slice(0, OPPONENTS_SHOWN).map((opposition) => ({
            key: opposition.opponentName,
            cells: [opposition.opponentName, opposition.scores.map((score) => scoreText(score.runs, score.notOut)).join(', '), String(opposition.runs)],
          }))}
        />
      )}
      {p.byOpposition.length > OPPONENTS_SHOWN && <Note>The first {OPPONENTS_SHOWN} of {p.byOpposition.length} opponents.</Note>}
    </>
  ),
}
