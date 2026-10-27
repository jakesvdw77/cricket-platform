import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HubProfile } from './HubProfile'
import type { ProfilePage } from './HubProfile'
import type { MyPlayer } from '../../../api/myPlayersApi'
import { LocationProbe } from '../../../test/LocationProbe'
import { agent, emptyDetails, makeMyPlayer } from '../../../test/myPlayerFixtures'

// docs/specs/119 3C and 121: the card shows on every page, fields with no value are hidden, each page has one Edit, agents are shown by role.
function renderProfile(player: MyPlayer, page: ProfilePage = 'contact') {
  return render(
    <MemoryRouter initialEntries={['/account/players/k1/profile']}>
      <Routes>
        <Route path="/account/players/k1/profile" element={<HubProfile player={player} page={page} />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const tile = (label: string) => screen.getByText(label, { selector: 'small' }).parentElement as HTMLElement

describe('HubProfile', () => {
  it('shows the card with the date of birth and age and the jersey on every page, and the filled fields as tiles on their own page', () => {
    const player = makeMyPlayer()
    const first = renderProfile(player)

    expect(screen.getByTestId('profile-card')).toBeInTheDocument()
    expect(within(tile('Date of birth')).getByText(/4 Mar 2012 \(age \d+\)/)).toBeInTheDocument()
    expect(within(screen.getByTestId('jersey-tile')).getByText('7')).toBeInTheDocument()
    expect(within(tile('Phone')).getByText('082 555 0100')).toBeInTheDocument()
    expect(within(tile('Alternative contact')).getByText('Priya Naidoo, 082 555 0200')).toBeInTheDocument()
    expect(within(tile('Provider')).getByText('Discovery')).toBeInTheDocument()
    expect(screen.queryByText('Batting', { selector: 'small' })).not.toBeInTheDocument()
    first.unmount()

    renderProfile(player, 'cricket')
    expect(screen.getByTestId('profile-card')).toBeInTheDocument()
    expect(within(tile('Batting')).getByText('Right-handed')).toBeInTheDocument()
    expect(within(tile('Bowling')).getByText('Right-arm')).toBeInTheDocument()
    expect(within(tile('Wicketkeeper')).getByText('Yes')).toBeInTheDocument()
    expect(screen.queryByText('Phone', { selector: 'small' })).not.toBeInTheDocument()
  })

  it('hides every field with no value, and the groups that end up empty', () => {
    renderProfile(makeMyPlayer({ ...emptyDetails, phone: '082 555 0100', sectionNames: ['Under 14'] }))

        expect(screen.queryByText('Email', { selector: 'small' })).not.toBeInTheDocument()
    expect(screen.queryByText('Jersey number', { selector: 'small' })).not.toBeInTheDocument()
    expect(screen.queryByText('Wicketkeeper', { selector: 'small' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cricket' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Medical aid' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
  })

  it('says Nothing added yet on a page with no details', () => {
    renderProfile(makeMyPlayer({ ...emptyDetails }), 'cricket')

    expect(screen.getByTestId('profile-empty')).toHaveTextContent('Nothing added yet')
  })

  it('the one Edit opens that page\'s edit view, and the card pencil opens the photo and date of birth view', async () => {
    const first = renderProfile(makeMyPlayer())
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/contact/edit')
    first.unmount()

    renderProfile(makeMyPlayer())
    await userEvent.click(screen.getByRole('button', { name: 'Edit photo and date of birth' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/contact/edit-card')
  })

  describe('agents', () => {
    const agentsPage = (player: MyPlayer) => renderProfile(player, 'agents')

    it('lists each agent by name and masked email with Primary and Pending markers, and the one Edit opens the agents edit view', async () => {
      agentsPage(
        makeMyPlayer({
          agentCount: 2,
          agents: [agent(), agent({ linkId: 'a2', name: 'Sam Smith', maskedEmail: 's***@example.com', main: false, status: 'INVITED' })],
        }),
      )

      const agents = within(screen.getByTestId('my-player-agents'))
      expect(agents.getByText('Priya Naidoo')).toBeInTheDocument()
      expect(agents.getByText('p***@example.com')).toBeInTheDocument()
      expect(agents.getByText('Primary agent')).toBeInTheDocument()
      expect(agents.getByText('Pending invitation')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Hand over' })).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/agents/edit')
    })

    it('another agent sees only a count and can Leave, with no Edit', async () => {
      agentsPage(makeMyPlayer({ main: false, canManageAgents: false, agentCount: 2, agents: [] }))

      expect(within(screen.getByTestId('my-player-agents')).getByText('2 agents manage this player.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/agents/leave')
    })

    it('hides Leave while the caller\'s own link id is not provided', () => {
      agentsPage(makeMyPlayer({ main: false, canManageAgents: false, myLinkId: null }))

      expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
    })

    it('a player\'s own record never offers Leave', () => {
      agentsPage(makeMyPlayer({ self: true, canManageAgents: false }))

      expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
    })

    it('uses the singular for one agent', () => {
      agentsPage(makeMyPlayer({ main: false, canManageAgents: false, agentCount: 1, agents: [] }))

      expect(screen.getByText('1 agent manages this player.')).toBeInTheDocument()
    })
  })
})
