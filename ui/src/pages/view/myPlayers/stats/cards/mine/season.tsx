import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { Sparkline } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_TONES } from '../../../../../../brandTokens'
import { Big, Cap, Chips, FaceTable, Note, Tiles } from '../../cardParts'
import { battingBasis } from '../../cardKit'
import { DASH, dayText, formatCount, formatDecimal, plural, scoreText } from '../../statsFormat'

// docs/specs/147 section 5, mine.season: the headline of the season. Front: runs, innings, average, strike rate, highest score, the last
// five scores; innings played, not outs and times dismissed are stated outright (Amendment 2 item 4) and the runs at home and away sit here
// too (item 6; a home or away side with no innings is a dash and the matches with no venue are the partial note). Back: the rolling average of
// the last five innings with the server's trend sentence. Source: batting, form, rolling, homeAway.
export const mineSeason: StatsCardDef<MyStatsDto> = {
  id: 'mine.season',
  page: 'mine',
  group: 'batting',
  title: () => 'Season in a card',
  tag: 'HAVE',
  needs: ['batting', 'form', 'rolling', 'homeAway', 'basis'],
  order: 10,
  // Amendment 2 item 10: the hero card is tall (beside Innings and Dismissals stacked).
  size: 'tall',
  whenMissing: 'hide',
  emptyText: 'Not enough innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    if (p.batting.innings === 0) return 'empty'
    return p.batting.coverage.inningsWithBalls < p.batting.coverage.inningsCounted || p.homeAway.unknownFieldMatches > 0 ? 'partial' : 'ready'
  },
  partialNote: (p) =>
    [
      p.batting.coverage.inningsWithBalls < p.batting.coverage.inningsCounted ? `Strike rate is from ${p.batting.coverage.inningsWithBalls} of ${p.batting.coverage.inningsCounted} innings.` : '',
      p.homeAway.unknownFieldMatches > 0 ? `${plural(p.homeAway.unknownFieldMatches, 'match', 'matches')} with no venue recorded are left out of home and away.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  summary: (p, ctx) =>
    `${ctx.firstName} has ${p.batting.runs} runs in ${plural(p.batting.innings, 'innings', 'innings')} (${p.batting.notOuts} not out, dismissed ${p.batting.dismissals} times), averaging ${formatDecimal(p.batting.average)}.`,
  Front: ({ payload: p, ctx }) => {
    const best = p.batting.highestScore
    return (
      <>
        <Big value={String(p.batting.runs)} caption={`runs in ${plural(p.batting.innings, 'innings', 'innings')}`} />
        <Tiles
          items={[
            { key: 'innings', label: 'Innings', value: String(p.batting.innings) },
            { key: 'notouts', label: 'Not Out', value: String(p.batting.notOuts) },
            { key: 'dismissed', label: 'Dismissed', value: String(p.batting.dismissals) },
          ]}
        />
        <Tiles
          items={[
            { key: 'avg', label: 'Avg', value: formatDecimal(p.batting.average) },
            { key: 'sr', label: 'SR', value: formatDecimal(p.batting.strikeRate) },
            { key: 'hs', label: 'HS', value: best ? scoreText(best.runs, best.notOut) : DASH },
          ]}
        />
        <Tiles
          items={[
            { key: 'home-runs', label: 'Home Runs', value: p.homeAway.home.innings > 0 ? formatCount(p.homeAway.home.runs) : DASH },
            { key: 'away-runs', label: 'Away Runs', value: p.homeAway.away.innings > 0 ? formatCount(p.homeAway.away.runs) : DASH },
          ]}
        />
        {p.form.batting.length > 0 && (
          <>
            <Cap>Last {Math.min(5, p.form.batting.length)} scores</Cap>
            <Chips
              items={p.form.batting.slice(0, 5).map((entry, index) => ({
                key: `${entry.matchId}-${index}`,
                text: scoreText(entry.runs, entry.notOut),
                tone: entry.notOut ? 'win' : entry.runs === 0 ? 'loss' : 'neutral',
                href: ctx.resultHref(entry.matchId),
                name: `${scoreText(entry.runs, entry.notOut)}, ${dayText(entry.matchDate)}. Open the match.`,
              }))}
            />
          </>
        )}
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const { rolling } = p
    const hint = rolling.hint
    const direction = hint?.direction === 'UP' ? 'up from' : hint?.direction === 'DOWN' ? 'down from' : 'level with'
    const sentence =
      hint && hint.recent !== null
        ? `Last ${rolling.span} average ${formatDecimal(hint.recent)}${hint.earlier !== null ? `, ${direction} ${formatDecimal(hint.earlier)} earlier` : ''}. Season average ${formatDecimal(p.batting.average)}.`
        : `Season average ${formatDecimal(p.batting.average)}. The trend needs a few more innings.`
    const latest = [...rolling.points].reverse().slice(0, 5)
    return (
      <>
        <Cap>Average of the last {rolling.span} innings</Cap>
        <Sparkline values={rolling.points.map((point) => point.average)} width={280} height={56} colour={STATS_TONES.gold} alt={`Rolling average of the last ${rolling.span} innings for ${ctx.firstName}: ${sentence}`} />
        <Note>{sentence}</Note>
        {latest.length > 0 && (
          <FaceTable
            label="Rolling average by innings"
            heads={['Date', `Avg of last ${rolling.span}`]}
            rows={latest.map((point, index) => ({
              key: `${point.matchId}-${index}`,
              cells: [dayText(point.matchDate), formatDecimal(point.average)],
              href: ctx.resultHref(point.matchId),
              linkName: `Open the match of ${dayText(point.matchDate)}`,
            }))}
          />
        )}
      </>
    )
  },
}
