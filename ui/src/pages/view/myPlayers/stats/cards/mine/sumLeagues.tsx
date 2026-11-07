import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable } from '../../cardParts'
import { truncatedNote } from '../../cardKit'
import { plural, need } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-leagues: how many leagues the player has played in. Back: matches played in each league (the top ones as bars on the front, the table here). Friendlies are not a league and are left out. Source: summary.leaguesPlayed.
export const mineSumLeagues: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-leagues',
  page: 'mine',
  group: 'summary',
  title: () => 'Leagues Played',
  tag: 'HAVE',
  needs: ['summary', 'basis'],
  order: 10,
  // Summary tile: a compact (15 rem) card, three to a row.
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No league matches yet.',
  state: (p) => (!p.summary ? 'missing' : p.summary.leaguesPlayed.length === 0 ? 'empty' : p.basis.truncated ? 'partial' : 'ready'),
  partialNote: truncatedNote,
  summary: (p, ctx) => `${ctx.firstName} has played in ${plural(need(p.summary).leaguesPlayed.length, 'league')}.`,
  Front: ({ payload: p, ctx }) => {
    const scope = ctx.scope
    const active = scope?.activeLeagueId ?? null
    const leagues = [...need(p.summary).leaguesPlayed].sort((a, b) => b.matches - a.matches)
    return (
      <BigBars
        unit={['match', 'matches']}
        value={String(leagues.length)}
        caption={leagues.length === 1 ? 'league' : 'leagues'}
        total={leagues.length}
        alt={`${ctx.firstName}'s matches in each league: ${leagues.map((league) => `${league.name} ${league.matches}`).join(', ')}.`}
        rows={leagues.map((league) => ({
          key: league.leagueId,
          label: league.name,
          value: league.matches,
          valueLabel: String(league.matches),
          ...(scope ? { onSelect: () => scope.filterLeague(active === league.leagueId ? null : league.leagueId), selected: active === league.leagueId } : {}),
        }))}
        hint={scope ? 'Tap a bar to filter' : undefined}
        clear={scope && active ? { label: 'Show all leagues', onClear: () => scope.filterLeague(null) } : undefined}
      />
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Matches in each league</Cap>
      <FaceTable label="Matches played in each league" heads={['League', 'Matches']} rows={need(p.summary).leaguesPlayed.map((league) => ({ key: league.leagueId, cells: [league.name, String(league.matches)] }))} />
    </>
  ),
}
