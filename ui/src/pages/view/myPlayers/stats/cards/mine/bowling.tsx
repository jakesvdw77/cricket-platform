import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { LineChart } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { againstText, bowlingBasis } from '../../cardKit'
import { dayText, formatDecimal, formatPercent, wicketsForRuns } from '../../statsFormat'
import { oversText } from '../../../resultsFormat'

// docs/specs/147 section 5, mine.bowling: wickets, best figures, economy, average and dot-ball percentage. Back: wickets in each innings
// bowled with the economy line, each dot a link to its match, and the same as a table. Source: bowling, series.bowlingMatches,
// series.economySummary.
const SHOWN_ROWS = 8

export const mineBowling: StatsCardDef<MyStatsDto> = {
  id: 'mine.bowling',
  page: 'mine',
  group: 'bowling',
  title: () => 'Bowling card',
  tag: 'HAVE',
  needs: ['bowling', 'series', 'basis'],
  order: 10,
  // Amendment 2 item 10: the chart card is tall (beside the two cards after it, stacked).
  size: 'tall',
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
    return (
      <>
        <Big value={String(p.bowling.wickets)} caption={`wickets · best ${best ? wicketsForRuns(best.wickets, best.runs) : '–'}`} />
        <Tiles
          items={[
            { key: 'econ', label: 'Econ', value: formatDecimal(p.bowling.economy, 2) },
            { key: 'avg', label: 'Avg', value: formatDecimal(p.bowling.average, 1) },
            { key: 'dots', label: 'Dots', value: formatPercent(p.bowling.dotBallPercentage, 0) },
          ]}
        />
        {spells.length > 0 && (
          <LineChart
            alt={`${ctx.firstName}'s wickets in each of ${spells.length} innings bowled, with the economy of each. The table on the back has every value.`}
            points={spells.map((spell, index) => ({
              key: `${spell.matchId}-${index}`,
              value: spell.wickets,
              href: ctx.resultHref(spell.matchId),
              name: `${spell.wickets} ${spell.wickets === 1 ? 'wicket' : 'wickets'} ${againstText(spell.opponentName)}, ${dayText(spell.matchDate)}`,
            }))}
            average={spells.map((spell) => spell.economy)}
            startLabel={dayText(spells[0].matchDate)}
            endLabel={dayText(spells[spells.length - 1].matchDate)}
          />
        )}
        <Note>Dots are wickets per innings, the blue line the economy. Tap a dot to open the match.</Note>
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
