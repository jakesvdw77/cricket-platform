import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ProgressBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { nOfM, plural } from '../../statsFormat'

// docs/specs/147 section 5, mine.availability: the share of availability polls answered, as "N of M" (the client works out no percentage).
// Back: selected versus played, and how many answers were "available". Source: availability.
export const mineAvailability: StatsCardDef<MyStatsDto> = {
  id: 'mine.availability',
  page: 'mine',
  group: 'teammate',
  title: () => 'Always there',
  tag: 'HAVE',
  needs: ['availability', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No availability polls yet.',
  basis: (p) => ({ counted: p.basis.resultsCounted, total: p.basis.resultsCounted }),
  state: (p) => (p.availability.pollsTotal === 0 && p.availability.matchesSelected === 0 ? 'empty' : 'ready'),
  summary: (p, ctx) => `${ctx.firstName} answered ${p.availability.pollsAnswered} of ${p.availability.pollsTotal} availability polls and played ${p.availability.matchesPlayed} matches.`,
  Front: ({ payload: p }) => {
    const a = p.availability
    return (
      <>
        <ProgressBars
          alt={`Availability polls answered: ${a.pollsAnswered} of ${a.pollsTotal}.`}
          rows={[{ key: 'answered', label: 'Polls answered', value: a.pollsAnswered, target: a.pollsTotal, text: nOfM(a.pollsAnswered, a.pollsTotal) }]}
        />
        <Note>
          Selected {plural(a.matchesSelected, 'time')}, played {a.matchesPlayed}.
        </Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const a = p.availability
    return (
      <>
        <Cap>Selected v played</Cap>
        <FaceTable
          label="Availability, selection and matches played"
          heads={['Item', 'Count']}
          rows={[
            { key: 'answered', cells: ['Polls answered', nOfM(a.pollsAnswered, a.pollsTotal)] },
            { key: 'available', cells: ['Answered available', nOfM(a.answeredAvailable, a.pollsAnswered)] },
            { key: 'selected', cells: ['Selected for', String(a.matchesSelected)] },
            { key: 'played', cells: ['Played', String(a.matchesPlayed)] },
          ]}
        />
      </>
    )
  },
}
