import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { truncatedNote } from '../../cardKit'
import { clip, plural } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-leagues: how many leagues the player has played in. Back: matches played in each league (bars
// and the table). Friendlies are not a league and are left out. Source: summary.leaguesPlayed.
const SHOWN = 8

export const mineSumLeagues: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-leagues',
  page: 'mine',
  group: 'summary',
  title: () => 'Leagues Played',
  tag: 'HAVE',
  needs: ['summary', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No league matches yet.',
  state: (p) => (p.summary.leaguesPlayed.length === 0 ? 'empty' : p.basis.truncated ? 'partial' : 'ready'),
  partialNote: truncatedNote,
  summary: (p, ctx) => `${ctx.firstName} has played in ${plural(p.summary.leaguesPlayed.length, 'league')}.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Big value={String(p.summary.leaguesPlayed.length)} caption={p.summary.leaguesPlayed.length === 1 ? 'league' : 'leagues'} />
      <Note>{ctx.firstName}'s league matches only; friendlies are not counted. Flip for the matches in each league.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const leagues = p.summary.leaguesPlayed
    return (
      <>
        <Cap>Matches in each league</Cap>
        <HorizontalBars
          alt={`${ctx.firstName}'s matches in each league: ${leagues.map((league) => `${league.name} ${league.matches}`).join(', ')}.`}
          rows={leagues.slice(0, SHOWN).map((league) => ({ key: league.leagueId, label: clip(league.name), value: league.matches, valueLabel: String(league.matches) }))}
        />
        <FaceTable label="Matches played in each league" heads={['League', 'Matches']} rows={leagues.map((league) => ({ key: league.leagueId, cells: [league.name, String(league.matches)] }))} />
        {leagues.length > SHOWN && <Note>The bars show the top {SHOWN}; the table lists every league.</Note>}
      </>
    )
  },
}
