import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ColumnChart } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { againstText, bowlingBasis } from '../../cardKit'
import { dayText, formatDecimal, formatPercent, wicketsForRuns } from '../../statsFormat'
import { oversText } from '../../../resultsFormat'

// docs/specs/147 section 5, mine.bowling: wickets, best figures, economy, average and dot-ball percentage. Back: wickets in each innings
// bowled with the economy line, each dot a link to its match, and the same as a table. Source: bowling, series.bowlingMatches,
// series.economySummary.
const SHOWN_ROWS = 8
// The columns on the front: the latest six innings bowled.
const RECENT = 6

export const mineBowling: StatsCardDef<MyStatsDto> = {
  id: 'mine.bowling',
  page: 'mine',
  group: 'bowling',
  title: () => 'Bowling card',
  tag: 'HAVE',
  needs: ['bowling', 'series', 'basis'],
  order: 10,
  // A normal card (the tall layout is supported but unused for now).
  whenMissing: 'hide',
  emptyText: 'No bowling yet.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    if (p.bowling.inningsBowled === 0) return 'empty'
    return p.bowling.coverage.inningsWithDots < p.bowling.coverage.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Dot balls are recorded in ${p.bowling.coverage.inningsWithDots} of ${p.bowling.coverage.inningsCounted} innings.`,
  summary: (p, ctx) => `${ctx.firstName} has ${p.bowling.wickets} wickets, with an economy of ${formatDecimal(p.bowling.economy, 2)}.`,
  Front: ({ payload: p, ctx }) => {
    const best = p.bowling.best
    const spells = p.series.bowlingMatches
    const recent = spells.slice(-RECENT)
    return (
      <>
        <Big value={String(p.bowling.wickets)} caption={`wickets · best ${best ? wicketsForRuns(best.wickets, best.runs) : '–'}`} />
        {recent.length > 0 && (
          <ColumnChart
            alt={`${ctx.firstName}'s wickets in each of the last ${recent.length} innings bowled, with the economy of each: ${recent.map((spell) => `${dayText(spell.matchDate)} ${spell.wickets} wickets, economy ${formatDecimal(spell.economy, 2)}`).join('; ')}. The table on the back has every value.`}
            columns={recent.map((spell, index) => ({
              key: `${spell.matchId}-${index}`,
              value: spell.wickets,
              valueLabel: String(spell.wickets),
              label: dayText(spell.matchDate),
              sub: `Econ ${formatDecimal(spell.economy, 2)}`,
              href: ctx.resultHref(spell.matchId),
              name: `${spell.wickets} ${spell.wickets === 1 ? 'wicket' : 'wickets'} ${againstText(spell.opponentName)}, ${dayText(spell.matchDate)}, economy ${formatDecimal(spell.economy, 2)}. Open the match.`,
            }))}
          />
        )}
        <Note>
          Econ {formatDecimal(p.bowling.economy, 2)} · Avg {formatDecimal(p.bowling.average, 1)} · Dots {formatPercent(p.bowling.dotBallPercentage, 0)}
        </Note>
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const spells = p.series.bowlingMatches
    const latest = [...spells].reverse().slice(0, SHOWN_ROWS)
    return (
      <>
        <Cap>Wickets and economy, innings by innings</Cap>
        <FaceTable
          label="Wickets and economy by innings"
          heads={['Date and opponent', 'Overs', 'Runs', 'Wkts', 'Econ']}
          rows={latest.map((spell, index) => ({
            key: `${spell.matchId}-${index}`,
            cells: [`${dayText(spell.matchDate)} ${spell.opponentName ? `v ${spell.opponentName}` : ''}`.trim(), oversText(spell.balls, spell.ballsPerOver).replace(/ overs?$/, ''), String(spell.runs), String(spell.wickets), formatDecimal(spell.economy, 2)],
            href: ctx.resultHref(spell.matchId),
            linkName: `Open the match of ${dayText(spell.matchDate)}`,
          }))}
        />
        {spells.length > SHOWN_ROWS && <Note>The latest {SHOWN_ROWS} of {spells.length} innings bowled.</Note>}
      </>
    )
  },
}
