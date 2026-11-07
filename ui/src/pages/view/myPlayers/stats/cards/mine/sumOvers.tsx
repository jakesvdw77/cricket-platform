import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { bowlingBasis, truncatedNote } from '../../cardKit'
import { dayText, oversOrBalls } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-overs: overs bowled, the balls beside them ("24.3 (147 balls)"). When the spells mix over
// lengths there is no single overs figure and the balls are shown. Back: overs in each bowling match. Source: summary, series.bowlingMatches.
const SHOWN = 8

export const mineSumOvers: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-overs',
  page: 'mine',
  group: 'summary',
  title: () => 'Overs Bowled',
  tag: 'HAVE',
  needs: ['summary', 'series', 'basis'],
  order: 60,
  whenMissing: 'hide',
  emptyText: 'No bowling yet.',
  basis: (p) => bowlingBasis(p),
  state: (p) => (p.summary.ballsBowled === 0 ? 'empty' : p.basis.truncated ? 'partial' : 'ready'),
  partialNote: truncatedNote,
  summary: (p, ctx) => `${ctx.firstName} has bowled ${oversOrBalls(p.summary.ballsBowled, p.summary.ballsPerOver)}${p.summary.ballsPerOver === null ? '' : ' overs'}.`,
  Front: ({ payload: p, ctx }) => {
    const { ballsBowled, ballsPerOver } = p.summary
    return (
      <>
        {ballsPerOver === null ? (
          <Big value={String(ballsBowled)} caption="balls bowled" />
        ) : (
          <Big value={oversOrBalls(ballsBowled, ballsPerOver)} caption={`overs (${ballsBowled} balls)`} />
        )}
        <Note>{ctx.firstName}'s bowling in these results. Flip for the overs in each match.</Note>
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const spells = p.series.bowlingMatches
    const latest = spells.slice(-SHOWN)
    return (
      <>
        <Cap>Overs in each bowling match</Cap>
        <HorizontalBars
          alt={`${ctx.firstName}'s overs in each of the last ${latest.length} bowling matches: ${latest.map((spell) => `${dayText(spell.matchDate)} ${oversOrBalls(spell.balls, spell.ballsPerOver)}`).join(', ')}.`}
          rows={latest.map((spell, index) => ({
            key: `${spell.matchId}-${index}`,
            label: dayText(spell.matchDate),
            value: spell.balls / Math.max(spell.ballsPerOver, 1),
            valueLabel: oversOrBalls(spell.balls, spell.ballsPerOver),
            href: ctx.resultHref(spell.matchId),
          }))}
        />
        <FaceTable
          label="Overs bowled in each match"
          heads={['Date and opponent', 'Overs']}
          rows={[...latest].reverse().map((spell, index) => ({
            key: `${spell.matchId}-${index}`,
            cells: [`${dayText(spell.matchDate)} ${spell.opponentName ? `v ${spell.opponentName}` : ''}`.trim(), oversOrBalls(spell.balls, spell.ballsPerOver)],
            href: ctx.resultHref(spell.matchId),
            linkName: `Open the match of ${dayText(spell.matchDate)}`,
          }))}
        />
        {spells.length > SHOWN && <Note>The latest {SHOWN} of {spells.length} bowling matches.</Note>}
      </>
    )
  },
}
