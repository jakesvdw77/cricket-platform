import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis, truncatedNote } from '../../cardKit'
import { formatDecimal, plural } from '../../statsFormat'

// docs/specs/147 section 5, mine.homeaway: the batting average at the club's own fields against away, where a field is recorded on the
// match. Tagged PARTLY: a match with no field recorded is left out of both and counted in the gap on the back. Source: homeAway.
export const mineHomeAway: StatsCardDef<MyStatsDto> = {
  id: 'mine.homeaway',
  page: 'mine',
  group: 'teammate',
  title: () => 'Home ground v away',
  tag: 'PARTLY',
  needs: ['homeAway', 'basis'],
  order: 20,
  // Amendment 2 item 6: its content moved into the batting card (home and away runs) and the venue cards, so it is left off the page.
  hidden: true,
  whenMissing: 'notCaptured',
  emptyText: 'Not enough innings yet.',
  missingText: 'No field is recorded on these matches, so home and away cannot be split.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    const { home, away, unknownFieldMatches } = p.homeAway
    if (home.innings + away.innings === 0) return unknownFieldMatches > 0 ? 'missing' : 'empty'
    return unknownFieldMatches > 0 || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) => (p.homeAway.unknownFieldMatches > 0 ? `${plural(p.homeAway.unknownFieldMatches, 'match', 'matches')} with no field recorded are left out.` : truncatedNote(p)),
  summary: (p, ctx) => `${ctx.firstName}'s batting average at home is ${formatDecimal(p.homeAway.home.average)} and away is ${formatDecimal(p.homeAway.away.average)}.`,
  Front: ({ payload: p }) => {
    const { home, away } = p.homeAway
    return (
      <>
        <HorizontalBars
          legend={['Home', 'Away']}
          alt={`Batting average at the club's fields ${formatDecimal(home.average)}, away ${formatDecimal(away.average)}.`}
          rows={[
            { key: 'home', label: 'Home', tone: 'compare', seriesIndex: 0, value: home.average ?? 0, valueLabel: formatDecimal(home.average) },
            { key: 'away', label: 'Away', tone: 'compare', seriesIndex: 1, value: away.average ?? 0, valueLabel: formatDecimal(away.average) },
          ]}
        />
        <Note>Batting average at the club's own fields against away grounds, where a field is recorded on the match.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const { home, away, unknownFieldMatches } = p.homeAway
    return (
      <>
        <Cap>Home and away</Cap>
        <FaceTable
          label="Batting at home and away"
          heads={['Where', 'Innings', 'Runs', 'Outs', 'Avg']}
          rows={[
            { key: 'home', cells: ['Home', String(home.innings), String(home.runs), String(home.dismissals), formatDecimal(home.average)] },
            { key: 'away', cells: ['Away', String(away.innings), String(away.runs), String(away.dismissals), formatDecimal(away.average)] },
          ]}
        />
        <Note>{plural(unknownFieldMatches, 'match', 'matches')} with no field recorded, left out of both.</Note>
      </>
    )
  },
}
