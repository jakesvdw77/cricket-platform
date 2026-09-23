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

  // docs/specs/048-match-availability-wrap-layout.md
  it('layout omitted (default) still truncates to an AvatarGroup "+N" overflow avatar for 9 respondents', () => {
    const respondents = [
      respondent({ playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith' }),
      respondent({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones' }),
      respondent({ playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee' }),
      respondent({ playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel' }),
      respondent({ playerProfileId: 'p5', firstName: 'Lee', lastName: 'Nguyen' }),
      respondent({ playerProfileId: 'p6', firstName: 'Tom', lastName: 'Brown' }),
      respondent({ playerProfileId: 'p7', firstName: 'Kim', lastName: 'Davis' }),
      respondent({ playerProfileId: 'p8', firstName: 'Zoe', lastName: 'Adams' }),
      respondent({ playerProfileId: 'p9', firstName: 'Max', lastName: 'Ford' }),
    ]

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={9} />)

    // max=4 caps the AvatarGroup at 4 total avatars (including the "+N" overflow avatar itself),
    // so 9 respondents render as 3 real avatars plus a "+6" overflow avatar — same math as the
    // "+2"-for-5-respondents case above.
    expect(screen.getByText('+6')).toBeInTheDocument()
  })

  it('layout="compact" behaves identically to the default, truncating to a "+N" overflow avatar for 9 respondents', () => {
    const respondents = [
      respondent({ playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith' }),
      respondent({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones' }),
      respondent({ playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee' }),
      respondent({ playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel' }),
      respondent({ playerProfileId: 'p5', firstName: 'Lee', lastName: 'Nguyen' }),
      respondent({ playerProfileId: 'p6', firstName: 'Tom', lastName: 'Brown' }),
      respondent({ playerProfileId: 'p7', firstName: 'Kim', lastName: 'Davis' }),
      respondent({ playerProfileId: 'p8', firstName: 'Zoe', lastName: 'Adams' }),
      respondent({ playerProfileId: 'p9', firstName: 'Max', lastName: 'Ford' }),
    ]

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={9} layout="compact" />)

    expect(screen.getByText('+6')).toBeInTheDocument()
  })

  it('layout="wrap" with 9 respondents renders exactly 9 individual avatars, no "+N" overflow avatar', () => {
    const respondents = [
      respondent({ playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith' }),
      respondent({ playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones' }),
      respondent({ playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee' }),
      respondent({ playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel' }),
      respondent({ playerProfileId: 'p5', firstName: 'Lee', lastName: 'Nguyen' }),
      respondent({ playerProfileId: 'p6', firstName: 'Tom', lastName: 'Brown' }),
      respondent({ playerProfileId: 'p7', firstName: 'Kim', lastName: 'Davis' }),
      respondent({ playerProfileId: 'p8', firstName: 'Zoe', lastName: 'Adams' }),
      respondent({ playerProfileId: 'p9', firstName: 'Max', lastName: 'Ford' }),
    ]

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={9} layout="wrap" />)

    for (const initials of ['JA', 'BO', 'AM', 'SA', 'LE', 'TO', 'KI', 'ZO', 'MA']) {
      expect(screen.getByText(initials)).toBeInTheDocument()
    }
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })

  it('layout="wrap" with exactly WRAP_LAYOUT_MAX (24) respondents renders all 24, no overflow avatar', () => {
    const respondents = Array.from({ length: 24 }, (_, index) => respondent({ playerProfileId: `p${index}` }))

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={24} layout="wrap" />)

    expect(document.querySelectorAll('.MuiAvatar-root')).toHaveLength(24)
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })

  it('layout="wrap" with WRAP_LAYOUT_MAX + 1 (25) respondents renders 24 individual avatars plus one "+1" overflow avatar', () => {
    const respondents = Array.from({ length: 25 }, (_, index) => respondent({ playerProfileId: `p${index}` }))

    render(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={25} layout="wrap" />)

    // 24 visible respondent avatars + 1 "+1" overflow avatar = 25 total .MuiAvatar-root elements.
    expect(document.querySelectorAll('.MuiAvatar-root')).toHaveLength(25)
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('the count/status-label caption renders identically regardless of layout value or respondent count', () => {
    const respondents = Array.from({ length: 9 }, (_, index) => respondent({ playerProfileId: `p${index}` }))

    const { rerender } = render(
      <AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={9} layout="compact" />,
    )
    expect(screen.getByText('9 Available')).toBeInTheDocument()

    rerender(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={9} layout="wrap" />)
    expect(screen.getByText('9 Available')).toBeInTheDocument()

    rerender(<AvailabilityRespondentAvatars status="AVAILABLE" respondents={respondents} count={9} />)
    expect(screen.getByText('9 Available')).toBeInTheDocument()
  })
})
