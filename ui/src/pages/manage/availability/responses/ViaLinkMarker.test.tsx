import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResponsesByPlayer } from './ResponsesByPlayer'
import { ResponsesByTimeSlot } from './ResponsesByTimeSlot'
import { ViaLinkMarker } from './ViaLinkMarker'
import { groupBySlot, viaLinkFor } from './responseHelpers'
import type { ResponseRow } from './responseHelpers'
import type { SectionAvailabilityRoundBracket, SectionAvailabilityRoundMatch } from '../../../../api/sectionAvailabilityApi'

const bracket: SectionAvailabilityRoundBracket = {
  windowId: 'w1',
  windowDate: '2030-06-06',
  dayPart: 'MORNING',
  availableCount: 1,
  unavailableCount: 0,
  unsureCount: 0,
  noResponseCount: 1,
  coveredMatchCount: 1,
}
const matches: SectionAvailabilityRoundMatch[] = []
const rows: ResponseRow[] = [
  {
    playerProfileId: 'p1',
    firstName: 'Jane',
    lastName: 'Smith',
    jerseyNumber: 7,
    statuses: [{ windowId: 'w1', dayPart: 'MORNING', windowDate: '2030-06-06', status: 'AVAILABLE', viaLink: true }],
  },
  {
    playerProfileId: 'p2',
    firstName: 'Bob',
    lastName: 'Jones',
    jerseyNumber: null,
    statuses: [{ windowId: 'w1', dayPart: 'MORNING', windowDate: '2030-06-06', status: 'UNSURE', viaLink: false }],
  },
]
const override = { onOverride: async () => true, pendingKey: null }

describe('via link marker', () => {
  it('renders its text', () => {
    render(<ViaLinkMarker />)
    expect(screen.getByText('via link')).toBeInTheDocument()
  })

  it('viaLinkFor is true only for a flagged answer', () => {
    expect(viaLinkFor(rows[0], 'w1')).toBe(true)
    expect(viaLinkFor(rows[1], 'w1')).toBe(false)
    expect(viaLinkFor(rows[0], 'other')).toBe(false)
  })

  it('shows once in the By player view, only for the link answer', () => {
    render(<ResponsesByPlayer rows={rows} brackets={[bracket]} override={override} />)
    expect(screen.getAllByText('via link')).toHaveLength(1)
  })

  it('shows once in the By time slot view, only for the link answer', () => {
    render(<ResponsesByTimeSlot slots={groupBySlot({ brackets: [bracket], responses: rows }, matches)} override={override} />)
    expect(screen.getAllByText('via link')).toHaveLength(1)
  })
})
