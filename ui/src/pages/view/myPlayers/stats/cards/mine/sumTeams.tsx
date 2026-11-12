import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable } from '../../cardParts'
import { truncatedNote } from '../../cardKit'
import { plural, need } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-teams: how many teams the player has played for. Back: matches played for each team (bars and
// the table). Source: summary.teamsRepresented.
export const mineSumTeams: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-teams',
  page: 'mine',
  group: 'summary',
  title: () => 'Teams Represented',
  tag: 'HAVE',
  needs: ['summary', 'basis'],
  order: 20,
  // Summary tile: a compact (14 rem) card, three to a row.
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No matches played yet.',
  state: (p) => (!p.summary ? 'missing' : p.summary.teamsRepresented.length === 0 ? 'empty' : p.basis.truncated ? 'partial' : 'ready'),
  partialNote: truncatedNote,
  summary: (p, ctx) => `${ctx.firstName} has played for ${plural(need(p.summary).teamsRepresented.length, 'team')}.`,
  Front: ({ payload: p, ctx }) => {
    const scope = ctx.scope
    const active = scope?.activeTeamId ?? null
    const teams = [...need(p.summary).teamsRepresented].sort((a, b) => b.matches - a.matches)
    return (
      <BigBars
        unit={['match', 'matches']}
        value={String(teams.length)}
        caption={teams.length === 1 ? 'team' : 'teams'}
        total={teams.length}
        alt={`${ctx.firstName}'s matches for each team: ${teams.map((team) => `${team.name} ${team.matches}`).join(', ')}.`}
        rows={teams.map((team) => ({
          key: team.teamId,
          label: team.name,
          value: team.matches,
          valueLabel: String(team.matches),
          ...(scope ? { onSelect: () => scope.filterTeam(active === team.teamId ? null : team.teamId), selected: active === team.teamId } : {}),
        }))}
        hint={scope ? 'Tap a bar to filter' : undefined}
        clear={scope && active ? { label: 'Show all teams', onClear: () => scope.filterTeam(null) } : undefined}
      />
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Matches for each team</Cap>
      <FaceTable label="Matches played for each team" heads={['Team', 'Matches']} rows={need(p.summary).teamsRepresented.map((team) => ({ key: team.teamId, cells: [team.name, String(team.matches)] }))} />
    </>
  ),
}
