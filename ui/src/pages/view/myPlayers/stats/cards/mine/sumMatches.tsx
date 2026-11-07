import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable, Note } from '../../cardParts'

// docs/specs/147 Amendment 2 item 3, mine.sum-matches: matches played. Back: matches in each season (the Season filter is ignored for this
// block, as for mine.seasons). Source: summary.matchesPlayed, bySeason.
export const mineSumMatches: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-matches',
  page: 'mine',
  group: 'summary',
  title: () => 'Matches Played',
  tag: 'HAVE',
  needs: ['summary', 'bySeason', 'basis'],
  order: 30,
  // Summary tile: a compact (15 rem) card, three to a row.
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No matches played yet.',
  state: (p) => (p.summary.matchesPlayed === 0 ? 'empty' : 'ready'),
  summary: (p, ctx) => `${ctx.firstName} has played ${p.summary.matchesPlayed} ${p.summary.matchesPlayed === 1 ? 'match' : 'matches'}.`,
  Front: ({ payload: p, ctx }) => {
    const seasons = [...p.bySeason].reverse()
    return (
      <BigBars
        unit={['match', 'matches']}
        value={String(p.summary.matchesPlayed)}
        caption={p.summary.matchesPlayed === 1 ? 'match played' : 'matches played'}
        total={seasons.length}
        alt={`${ctx.firstName}'s matches in each season: ${seasons.map((season) => `${season.label} ${season.matches}`).join(', ')}.`}
        rows={seasons.map((season) => ({ key: season.seasonId, label: season.label, value: season.matches, valueLabel: String(season.matches) }))}
      />
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Matches in each season</Cap>
      {p.bySeason.length === 0 ? (
        <Note>No seasons to show yet.</Note>
      ) : (
        <FaceTable label="Matches played in each season" heads={['Season', 'Matches']} rows={[...p.bySeason].reverse().map((season) => ({ key: season.seasonId, cells: [season.label, String(season.matches)] }))} />
      )}
    </>
  ),
}
