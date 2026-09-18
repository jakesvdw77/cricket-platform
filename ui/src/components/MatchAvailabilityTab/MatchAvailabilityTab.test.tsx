import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MatchAvailabilityTab } from './MatchAvailabilityTab'
import type { MatchAvailabilityTabProps } from './MatchAvailabilityTab'
import type { MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'

function makePoll(overrides: Partial<MatchAvailabilityPollResponses> = {}): MatchAvailabilityPollResponses {
  return {
    pollId: 'poll-1',
    teamId: 'team-1',
    open: true,
    availableCount: 1,
    unavailableCount: 1,
    unsureCount: 1,
    noResponseCount: 1,
    responses: [
      { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7, status: 'AVAILABLE' },
      { playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones', squadJerseyNumber: null, status: 'UNAVAILABLE' },
      { playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee', squadJerseyNumber: null, status: 'UNSURE' },
      { playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel', squadJerseyNumber: null, status: null },
    ],
    publicPath: '/poll/poll-1',
    ...overrides,
  }
}

function baseProps(overrides: Partial<MatchAvailabilityTabProps> = {}): MatchAvailabilityTabProps {
  return {
    label: 'the home side',
    poll: makePoll(),
    onCreate: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onShareInvite: vi.fn(),
    onSetPlayerStatus: vi.fn(),
    ...overrides,
  }
}

describe('MatchAvailabilityTab', () => {
  it('shows an "Open a poll" prompt when no poll exists yet, and calls onCreate', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<MatchAvailabilityTab {...baseProps({ poll: null, onCreate })} />)

    expect(screen.getByText(/no availability poll yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /open a poll for this side/i }))
    expect(onCreate).toHaveBeenCalled()
  })

  it('renders the response-count summary for an open poll', () => {
    render(<MatchAvailabilityTab {...baseProps()} />)

    expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unsure').length).toBeGreaterThan(0)
    expect(screen.getAllByText('No response').length).toBeGreaterThan(0)
    // Each of the four summary tiles carries its own count.
    expect(screen.getAllByText('1', { selector: 'h6' })).toHaveLength(4)
  })

  it('renders the full squad list with each member\'s status chip, jersey number included', () => {
    render(<MatchAvailabilityTab {...baseProps()} />)

    expect(screen.getByText('#7 Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getAllByText('No response').length).toBeGreaterThan(0)
  })

  it('calls onClose when toggling the switch off an open poll', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<MatchAvailabilityTab {...baseProps({ onClose })} />)

    expect(screen.getByText(/^poll open$/i)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a closed banner and calls onOpen when toggling the switch on for a closed poll', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<MatchAvailabilityTab {...baseProps({ poll: makePoll({ open: false }), onOpen })} />)

    expect(screen.getByText(/this poll is closed/i)).toBeInTheDocument()
    expect(screen.getByText(/^poll closed$/i)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('opens the share dialog action via onShareInvite', async () => {
    const user = userEvent.setup()
    const onShareInvite = vi.fn()
    render(<MatchAvailabilityTab {...baseProps({ onShareInvite })} />)

    await user.click(screen.getByRole('button', { name: /share invite/i }))
    expect(onShareInvite).toHaveBeenCalled()
  })

  it('opens a status menu on a squad member\'s Chip and calls onSetPlayerStatus with the chosen status', async () => {
    const user = userEvent.setup()
    const onSetPlayerStatus = vi.fn()
    render(<MatchAvailabilityTab {...baseProps({ onSetPlayerStatus })} />)

    await user.click(screen.getByRole('button', { name: /jane smith's availability/i }))
    await user.click(await screen.findByRole('menuitem', { name: 'Unavailable' }))

    expect(onSetPlayerStatus).toHaveBeenCalledWith('p1', 'UNAVAILABLE')
  })

  it('lets the admin set a status for a squad member with no response yet', async () => {
    const user = userEvent.setup()
    const onSetPlayerStatus = vi.fn()
    render(<MatchAvailabilityTab {...baseProps({ onSetPlayerStatus })} />)

    await user.click(screen.getByRole('button', { name: /set sam patel's availability/i }))
    await user.click(await screen.findByRole('menuitem', { name: 'Available' }))

    expect(onSetPlayerStatus).toHaveBeenCalledWith('p4', 'AVAILABLE')
  })

  it('disables the status Chip for every row when the poll is closed', () => {
    render(<MatchAvailabilityTab {...baseProps({ poll: makePoll({ open: false }) })} />)

    expect(screen.getByRole('button', { name: /jane smith's availability/i })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: /set sam patel's availability/i })).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows a pending state only on the row currently being saved', () => {
    render(<MatchAvailabilityTab {...baseProps({ settingPlayerId: 'p1' })} />)

    expect(screen.getByRole('button', { name: /jane smith's availability/i })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: /set bob jones's availability/i })).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('surfaces a server error inline', () => {
    render(<MatchAvailabilityTab {...baseProps({ errorMessage: 'Something went wrong.' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('shows a loading state', () => {
    render(<MatchAvailabilityTab {...baseProps({ isLoading: true })} />)
    expect(screen.getByText(/loading availability/i)).toBeInTheDocument()
  })
})
