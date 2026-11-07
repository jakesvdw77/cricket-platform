import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, Note, Tiles } from '../../cardParts'
import { formatDecimal, nOfM, plural } from '../../statsFormat'
import { truncatedTeamNote } from '../../teamKit'

// docs/specs/147 section 5, team.squad: how many players the team used and the average number available from the polls. Back: the close
// games (decided by fewer than the server's closeRuns runs or closeWickets wickets). Source: squad, closeGames, basis.
export const teamSquad: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.squad',
  page: 'team',
  group: 'squad',
  title: () => 'Squad strength',
  tag: 'HAVE',
  needs: ['squad', 'closeGames', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No squad figures yet.',
  basis: (p) => ({ counted: p.squad.counted, total: p.basis.resultsCounted }),
  state: (p) => {
    if (p.squad.playersUsed === 0 && p.squad.guestAppearances === 0) return 'empty'
    return p.squad.partly ? 'partial' : 'ready'
  },
  partialNote: (p) => `The availability average is from ${p.squad.matchesWithPoll} of ${p.squad.counted} results that had a poll.`,
  summary: (p) => `${p.teamName} used ${plural(p.squad.playersUsed, 'player')}.`,
  Front: ({ payload: p }) => (
    <>
      <Big value={String(p.squad.playersUsed)} caption="players used" />
      <Tiles
        items={[
          { key: 'avail', label: 'Avg available', value: formatDecimal(p.squad.averageAvailable, 1) },
          { key: 'guests', label: 'Guest games', value: String(p.squad.guestAppearances) },
        ]}
      />
      <Note>
        {p.squad.averageAvailable === null
          ? 'No availability polls have closed for this team yet.'
          : `Average of ${formatDecimal(p.squad.averageAvailable, 1)} available per match, from the availability polls.`}
      </Note>
    </>
  ),
  Back: ({ payload: p }) => {
    const close = p.closeGames
    return (
      <>
        <Cap>Won the close ones</Cap>
        {close.decided === 0 ? (
          <Note>No decided games yet.</Note>
        ) : (
          <>
            <Big value={nOfM(close.won, close.played)} caption={`close games won · under ${close.closeRuns} runs or ${close.closeWickets} wickets`} />
            <Note>Margins are stored for {nOfM(close.withMargin, close.decided)} decided games, and only those are counted.</Note>
          </>
        )}
        {p.basis.truncated && <Note>{truncatedTeamNote(p)}</Note>}
      </>
    )
  },
}
