import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { BigBars, Cap, FaceTable, Note } from '../../cardParts'

// docs/specs/147 Amendment 3, team.sum-matches: matches played. Front: the total with Won, Lost and Tied bars (win green, loss coral, tied
// neutral). Back: the full record as a table. Source: record, basis.
export const teamSumMatches: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-matches',
  page: 'team',
  group: 'summary',
  title: () => 'Matches Played',
  tag: 'HAVE',
  needs: ['record', 'basis'],
  order: 10,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No matches played yet.',
  state: (p) => (p.record.played === 0 ? 'empty' : 'ready'),
  summary: (p) => `${p.teamName} has played ${p.record.played} ${p.record.played === 1 ? 'match' : 'matches'}: ${p.record.won} won, ${p.record.lost} lost, ${p.record.tied} tied.`,
  Front: ({ payload: p }) => (
    <BigBars
      value={String(p.record.played)}
      caption={p.record.played === 1 ? 'match played' : 'matches played'}
      total={3}
      alt={`${p.teamName}'s record: ${p.record.won} won, ${p.record.lost} lost, ${p.record.tied} tied.`}
      rows={[
        { key: 'won', label: 'Won', value: p.record.won, valueLabel: String(p.record.won), colour: STATS_COLOUR.good },
        { key: 'lost', label: 'Lost', value: p.record.lost, valueLabel: String(p.record.lost), colour: STATS_COLOUR.bad },
        { key: 'tied', label: 'Tied', value: p.record.tied, valueLabel: String(p.record.tied) },
      ]}
    />
  ),
  Back: ({ payload: p }) => (
    <>
      <Cap>The record</Cap>
      <FaceTable
        label="Matches won, lost, tied, drawn and with no result"
        heads={['Result', 'Matches']}
        rows={[
          { key: 'played', cells: ['Played', String(p.record.played)] },
          { key: 'won', cells: ['Won', String(p.record.won)] },
          { key: 'lost', cells: ['Lost', String(p.record.lost)] },
          { key: 'tied', cells: ['Tied', String(p.record.tied)] },
          { key: 'drawn', cells: ['Drawn', String(p.record.drawn)] },
          { key: 'noresult', cells: ['No result', String(p.record.noResult)] },
        ]}
      />
      {(p.basis.forfeits.received > 0 || p.basis.forfeits.conceded > 0) && <Note>Forfeits: {p.basis.forfeits.received} received, {p.basis.forfeits.conceded} conceded.</Note>}
    </>
  ),
}
