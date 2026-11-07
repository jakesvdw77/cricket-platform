import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Cap, FaceTable, Note, Split } from '../../cardParts'
import { bowlingBasis } from '../../cardKit'
import { formatDecimal, oversOrBalls, plural } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 6, mine.bowling-homeaway: wickets and economy at the club's own fields against away. A spell in a match
// with no playing area is left out of both and shown as the gap. Back: the same as a table. Source: bowlingHomeAway.
export const mineBowlingHomeAway: StatsCardDef<MyStatsDto> = {
  id: 'mine.bowling-homeaway',
  page: 'mine',
  group: 'bowling',
  title: () => 'Bowling Home And Away',
  tag: 'PARTLY',
  needs: ['bowlingHomeAway', 'basis'],
  order: 40,
  whenMissing: 'notCaptured',
  emptyText: 'No bowling yet.',
  missingText: 'No venue is recorded on these matches, so home and away cannot be split.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    const { home, away, unknownVenueSpells } = p.bowlingHomeAway
    if (home.spells + away.spells === 0) return unknownVenueSpells > 0 ? 'missing' : 'empty'
    return unknownVenueSpells > 0 ? 'partial' : 'ready'
  },
  partialNote: (p) => `${plural(p.bowlingHomeAway.unknownVenueSpells, 'spell')} with no venue left out.`,
  summary: (p, ctx) => `${ctx.firstName} has ${p.bowlingHomeAway.home.wickets} wickets at home and ${p.bowlingHomeAway.away.wickets} away.`,
  Front: ({ payload: p }) => {
    const { home, away } = p.bowlingHomeAway
    const column = (key: string, title: string, side: typeof home, swatch: string) => ({
      key,
      title,
      swatch,
      rows: [
        { key: `${key}-wkts`, label: 'Wickets', value: String(side.wickets) },
        { key: `${key}-econ`, label: 'Economy', value: formatDecimal(side.economy, 2) },
        { key: `${key}-spells`, label: 'Spells', value: String(side.spells) },
      ],
    })
    return <Split columns={[column('home', 'Home', home, STATS_COLOUR.compareFirst), column('away', 'Away', away, STATS_COLOUR.compareSecond)]} />
  },
  Back: ({ payload: p }) => {
    const { home, away, unknownVenueSpells } = p.bowlingHomeAway
    return (
      <>
        <Cap>Home and away</Cap>
        <FaceTable
          label="Bowling at home and away"
          heads={['Where', 'Spells', 'Overs', 'Runs', 'Wkts', 'Econ', 'Avg']}
          rows={[
            { key: 'home', cells: ['Home', String(home.spells), oversOrBalls(home.balls, home.ballsPerOver), String(home.runs), String(home.wickets), formatDecimal(home.economy, 2), formatDecimal(home.average)] },
            { key: 'away', cells: ['Away', String(away.spells), oversOrBalls(away.balls, away.ballsPerOver), String(away.runs), String(away.wickets), formatDecimal(away.economy, 2), formatDecimal(away.average)] },
          ]}
        />
        <Note>{plural(unknownVenueSpells, 'spell')} in matches with no venue recorded, left out of both.</Note>
      </>
    )
  },
}
