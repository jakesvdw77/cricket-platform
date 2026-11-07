import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { clip } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-matches: matches played. Back: matches in each season (the Season filter is ignored for this
// block, as for mine.seasons). Source: summary.matchesPlayed, bySeason.
const SHOWN = 8

export const mineSumMatches: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-matches',
  page: 'mine',
  group: 'summary',
  title: () => 'Matches Played',
  tag: 'HAVE',
  needs: ['summary', 'bySeason', 'basis'],
  order: 30,
  whenMissing: 'hide',
  emptyText: 'No matches played yet.',
  state: (p) => (p.summary.matchesPlayed === 0 ? 'empty' : 'ready'),
  summary: (p, ctx) => `${ctx.firstName} has played ${p.summary.matchesPlayed} ${p.summary.matchesPlayed === 1 ? 'match' : 'matches'}.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Big value={String(p.summary.matchesPlayed)} caption={p.summary.matchesPlayed === 1 ? 'match played' : 'matches played'} />
      <Note>Every counted match {ctx.firstName} played in. Flip for the matches in each season.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const seasons = p.bySeason.slice(-SHOWN)
    return (
      <>
        <Cap>Matches in each season</Cap>
        {p.bySeason.length === 0 ? (
          <Note>No seasons to show yet.</Note>
        ) : (
          <>
            <HorizontalBars
              alt={`${ctx.firstName}'s matches in each season: ${seasons.map((season) => `${season.label} ${season.matches}`).join(', ')}.`}
              rows={seasons.map((season) => ({ key: season.seasonId, label: clip(season.label), value: season.matches, valueLabel: String(season.matches) }))}
            />
            <FaceTable label="Matches played in each season" heads={['Season', 'Matches']} rows={[...p.bySeason].reverse().slice(0, SHOWN).map((season) => ({ key: season.seasonId, cells: [season.label, String(season.matches)] }))} />
            {p.bySeason.length > SHOWN && <Note>The latest {SHOWN} of {p.bySeason.length} seasons.</Note>}
          </>
        )}
      </>
    )
  },
}
