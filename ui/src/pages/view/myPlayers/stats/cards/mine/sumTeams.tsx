import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { truncatedNote } from '../../cardKit'
import { clip, plural } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-teams: how many teams the player has played for. Back: matches played for each team (bars and
// the table). Source: summary.teamsRepresented.
const SHOWN = 8

export const mineSumTeams: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-teams',
  page: 'mine',
  group: 'summary',
  title: () => 'Teams Represented',
  tag: 'HAVE',
  needs: ['summary', 'basis'],
  order: 20,
  whenMissing: 'hide',
  emptyText: 'No matches played yet.',
  state: (p) => (p.summary.teamsRepresented.length === 0 ? 'empty' : p.basis.truncated ? 'partial' : 'ready'),
  partialNote: truncatedNote,
  summary: (p, ctx) => `${ctx.firstName} has played for ${plural(p.summary.teamsRepresented.length, 'team')}.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Big value={String(p.summary.teamsRepresented.length)} caption={p.summary.teamsRepresented.length === 1 ? 'team' : 'teams'} />
      <Note>The teams {ctx.firstName} has played for in these results. Flip for the matches for each team.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const teams = p.summary.teamsRepresented
    return (
      <>
        <Cap>Matches for each team</Cap>
        <HorizontalBars
          alt={`${ctx.firstName}'s matches for each team: ${teams.map((team) => `${team.name} ${team.matches}`).join(', ')}.`}
          rows={teams.slice(0, SHOWN).map((team) => ({ key: team.teamId, label: clip(team.name), value: team.matches, valueLabel: String(team.matches) }))}
        />
        <FaceTable label="Matches played for each team" heads={['Team', 'Matches']} rows={teams.map((team) => ({ key: team.teamId, cells: [team.name, String(team.matches)] }))} />
        {teams.length > SHOWN && <Note>The bars show the top {SHOWN}; the table lists every team.</Note>}
      </>
    )
  },
}
