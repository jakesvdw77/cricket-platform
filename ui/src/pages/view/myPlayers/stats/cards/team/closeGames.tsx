import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ProgressBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { DASH, nOfM } from '../../statsFormat'
import { matchLabel } from '../../teamKit'

// docs/specs/147 Amendment 3, team.close-games: close games and margins. Front: the close games won (decided by fewer than the server's
// closeRuns runs or closeWickets wickets) as a win-green bar. Back: the close-game figures, the biggest wins and the highest chase, each
// match a link to its Result page. The margins of defeats are not a server figure, so only the wins are listed. Source: closeGames,
// chasing, basis.
export const teamCloseGames: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.close-games',
  page: 'team',
  group: 'squad',
  title: () => 'Close Games And Margins',
  tag: 'PARTLY',
  needs: ['closeGames', 'chasing', 'basis'],
  order: 20,
  whenMissing: 'hide',
  emptyText: 'No decided games yet.',
  basis: (p) => ({ counted: p.closeGames.withMargin, total: p.closeGames.decided }),
  state: (p) => {
    if (p.closeGames.decided === 0) return 'empty'
    return p.closeGames.withMargin < p.closeGames.decided ? 'partial' : 'ready'
  },
  partialNote: (p) => `Margins are stored for ${nOfM(p.closeGames.withMargin, p.closeGames.decided)} decided games, and only those are counted.`,
  summary: (p) => `${p.teamName} won ${nOfM(p.closeGames.won, p.closeGames.played)} close games.`,
  Front: ({ payload: p }) => (
    <>
      <Big value={nOfM(p.closeGames.won, p.closeGames.played)} caption="close games won" />
      <ProgressBars
        alt={`${p.teamName} won ${nOfM(p.closeGames.won, p.closeGames.played)} close games.`}
        rows={[{ key: 'close', label: 'Close games won', colour: STATS_COLOUR.good, value: p.closeGames.won, target: p.closeGames.played, text: nOfM(p.closeGames.won, p.closeGames.played) }]}
      />
      <Note>Decided by fewer than {p.closeGames.closeRuns} runs or {p.closeGames.closeWickets} wickets.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const { largestVictoryByRuns: byRuns, largestVictoryByWickets: byWickets, highestSuccessfulChase: chase } = p.chasing
    const margins = [
      ...(byRuns ? [{ key: 'runs', label: 'Biggest win by runs', value: String(byRuns.margin), ref: byRuns }] : []),
      ...(byWickets ? [{ key: 'wickets', label: 'Biggest win by wickets', value: String(byWickets.margin), ref: byWickets }] : []),
      ...(chase ? [{ key: 'chase', label: 'Highest chase', value: `${chase.runs} (target ${chase.target})`, ref: chase }] : []),
    ]
    return (
      <>
        <Cap>Close games</Cap>
        <FaceTable
          label="Close games played, won and decided"
          heads={['Figure', 'Value']}
          rows={[
            { key: 'played', cells: ['Close games', String(p.closeGames.played)] },
            { key: 'won', cells: ['Won', String(p.closeGames.won)] },
            { key: 'decided', cells: ['Decided games', String(p.closeGames.decided)] },
            { key: 'margin', cells: ['With a margin stored', String(p.closeGames.withMargin)] },
          ]}
        />
        <Cap>Biggest wins</Cap>
        {margins.length === 0 ? (
          <Note>No wins with a margin yet.</Note>
        ) : (
          <FaceTable
            label="Biggest wins by runs and by wickets and the highest chase"
            heads={['Margin', 'Value', 'Match']}
            rows={margins.map((margin) => ({
              key: margin.key,
              cells: [margin.label, margin.value, margin.ref.opponentName ?? DASH],
              href: ctx.resultHref(margin.ref.matchId),
              linkName: `Open the match: ${matchLabel(margin.ref)}`,
            }))}
          />
        )}
      </>
    )
  },
}
