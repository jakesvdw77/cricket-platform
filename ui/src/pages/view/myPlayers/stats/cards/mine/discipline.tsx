import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { bowlingBasis, truncatedNote } from '../../cardKit'
import { DASH, dayText, formatDecimal } from '../../statsFormat'

// docs/specs/147 Addendum, mine.discipline: the wides and no-balls the bowler gave away and per over. Byes and leg byes belong to the team,
// never to a bowler. Back: the same by innings, with a dash where a spell did not record it (never a zero). Source: bowlingDiscipline.
const SHOWN_ROWS = 8
const count = (value: number | null): string => (value === null ? DASH : String(value))

export const mineDiscipline: StatsCardDef<MyStatsDto> = {
  id: 'mine.discipline',
  page: 'mine',
  group: 'bowling',
  title: () => 'Bowling discipline',
  tag: 'HAVE',
  needs: ['bowlingDiscipline', 'bowling', 'basis'],
  order: 30,
  whenMissing: 'notCaptured',
  emptyText: 'No bowling yet.',
  missingText: 'Wides and no-balls were not recorded for these spells.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    const discipline = p.bowlingDiscipline
    if (discipline.inningsCounted === 0) return 'empty'
    if (discipline.inningsRecorded === 0) return 'missing'
    return discipline.inningsRecorded < discipline.inningsCounted || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) =>
    p.bowlingDiscipline.inningsRecorded < p.bowlingDiscipline.inningsCounted
      ? `Wides and no-balls are recorded in ${p.bowlingDiscipline.inningsRecorded} of ${p.bowlingDiscipline.inningsCounted} spells.`
      : truncatedNote(p),
  summary: (p, ctx) => `${ctx.firstName} has bowled ${p.bowlingDiscipline.wides} wides and ${p.bowlingDiscipline.noBalls} no-balls.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Tiles
        min={110}
        items={[
          { key: 'wides', label: 'Wides', value: String(p.bowlingDiscipline.wides) },
          { key: 'noballs', label: 'No-balls', value: String(p.bowlingDiscipline.noBalls) },
          { key: 'widesper', label: 'Wides per over', value: formatDecimal(p.bowlingDiscipline.widesPerOver, 2) },
          { key: 'noballsper', label: 'No-balls per over', value: formatDecimal(p.bowlingDiscipline.noBallsPerOver, 2) },
        ]}
      />
      <Note>Extras from {ctx.firstName}'s deliveries. Byes belong to the team.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const spells = [...p.bowlingDiscipline.byInnings].reverse().slice(0, SHOWN_ROWS)
    return (
      <>
        <Cap>By innings</Cap>
        <FaceTable
          label="Wides and no-balls by innings"
          heads={['Date and opponent', 'Wides', 'No-balls']}
          rows={spells.map((spell, index) => ({
            key: `${spell.matchId}-${index}`,
            cells: [`${dayText(spell.matchDate)} ${spell.opponentName ? `v ${spell.opponentName}` : ''}`.trim(), count(spell.wides), count(spell.noBalls)],
            href: ctx.resultHref(spell.matchId),
            linkName: `Open the match of ${dayText(spell.matchDate)}`,
          }))}
        />
        {p.bowlingDiscipline.byInnings.length > SHOWN_ROWS && <Note>The latest {SHOWN_ROWS} of {p.bowlingDiscipline.byInnings.length} innings bowled.</Note>}
      </>
    )
  },
}
