import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AvailabilityRespondentAvatars } from './AvailabilityRespondentAvatars'
import type { AvailabilityRespondent } from '../../api/matchAvailabilityApi'

function respondent(overrides: Partial<AvailabilityRespondent> = {}): AvailabilityRespondent {
  return {
    playerProfileId: 'p1',
    firstName: 'Jane',
    lastName: 'Smith',
    squadJerseyNumber: null,
    ...overrides,
  }
}

describe('AvailabilityRespondentAvatars', () => {
  it('renders one avatar per respondent up to the overflow threshold', () => {
    const respondents = [
      respondent({ playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith' }),
      respondent({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones' }),
      respondent({ playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee' }),
    ]

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={3} />)

    expect(screen.getByText('JA')).toBeInTheDocument()
    expect(screen.getByText('BO')).toBeInTheDocument()
    expect(screen.getByText('AM')).toBeInTheDocument()
  })

  it('renders a "+N" MUI overflow avatar beyond max', () => {
    const respondents = [
      respondent({ playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith' }),
      respondent({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones' }),
      respondent({ playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee' }),
      respondent({ playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel' }),
      respondent({ playerProfileId: 'p5', firstName: 'Lee', lastName: 'Nguyen' }),
    ]

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={5} />)

    // max=4 caps the AvatarGroup at 4 total avatars (including the "+N" overflow avatar itself),
    // so 5 respondents render as 3 real avatars plus a "+2" overflow avatar.
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('the explicit count label always matches the count prop, regardless of how many avatars render', () => {
    const respondents = [respondent({ playerProfileId: 'p1' })]

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={9} />)

    expect(screen.getByText('9 Available')).toBeInTheDocument()
  })

  it('renders the correct label per status', () => {
    const { rerender } = render(<AvailabilityRespondentAvatars status="UNAVAILABLE" respondents={[]} count={0} />)
    expect(screen.getByText('0 Unavailable')).toBeInTheDocument()

    rerender(<AvailabilityRespondentAvatars status="UNSURE" respondents={[]} count={0} />)
    expect(screen.getByText('0 Unsure')).toBeInTheDocument()
  })

  it('empty respondents renders the count with no avatars rather than an empty AvatarGroup', () => {
    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={[]} count={0} />)

    expect(screen.getByText('0 Available')).toBeInTheDocument()
    expect(screen.queryByText('JA')).not.toBeInTheDocument()
  })

  it('shows the respondent\'s squad display name in a tooltip', async () => {
    const user = userEvent.setup()
    const respondents = [
      respondent({ playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7 }),
    ]

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={1} />)

    await user.hover(screen.getByText('JA'))

    expect(await screen.findByText('#7 Jane Smith')).toBeInTheDocument()
  })
})
