import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HubProfile } from './HubProfile'
import type { MyPlayer } from '../../../api/myPlayersApi'
import { LocationProbe } from '../../../test/LocationProbe'
import { agent, emptyDetails, makeMyPlayer } from '../../../test/myPlayerFixtures'

// docs/specs/119 3C and slice 4: fields with no value are hidden, a mostly empty profile is prompted, agents are shown by role.
function renderProfile(player: MyPlayer) {
  return render(
    <MemoryRouter initialEntries={['/account/players/k1/profile']}>
      <Routes>
        <Route path="/account/players/k1/profile" element={<HubProfile player={player} page="contact" />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const tile = (label: string) => screen.getByText(label, { selector: 'small' }).parentElement as HTMLElement

describe('HubProfile', () => {
  it('shows the filled fields as tiles under their group, with the date of birth and age', () => {
    renderProfile(makeMyPlayer())

    expect(within(tile('Date of birth')).getByText(/4 Mar 2012 \(age \d+\)/)).toBeInTheDocument()
    expect(within(tile('Jersey number')).getByText('7')).toBeInTheDocument()
    expect(within(tile('Phone')).getByText('082 555 0100')).toBeInTheDocument()
    expect(within(tile('Alternative contact')).getByText('Priya Naidoo, 082 555 0200')).toBeInTheDocument()
    expect(within(tile('Batting')).getByText('Right-handed')).toBeInTheDocument()
    expect(within(tile('Bowling')).getByText('Right-arm')).toBeInTheDocument()
    expect(within(tile('Wicketkeeper')).getByText('Yes')).toBeInTheDocument()
    expect(within(tile('Provider')).getByText('Discovery')).toBeInTheDocument()
    expect(screen.queryByTestId('complete-profile')).not.toBeInTheDocument()
  })

  it('hides every field with no value, and the groups that end up empty', () => {
    renderProfile(makeMyPlayer({ ...emptyDetails, phone: '082 555 0100', sectionNames: ['Under 14'] }))

    expect(screen.queryByText('Date of birth', { selector: 'small' })).not.toBeInTheDocument()
    expect(screen.queryByText('Email', { selector: 'small' })).not.toBeInTheDocument()
    expect(screen.queryByText('Jersey number', { selector: 'small' })).not.toBeInTheDocument()
    expect(screen.queryByText('Wicketkeeper', { selector: 'small' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cricket' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Medical aid' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
  })

  it('prompts Complete this profile when most details are missing', () => {
    renderProfile(makeMyPlayer({ ...emptyDetails }))

    const prompt = screen.getByTestId('complete-profile')
    expect(prompt).toHaveTextContent('Complete this profile')
    expect(prompt).toHaveTextContent('Add contact and cricket details with Edit profile.')
  })

  it('Edit profile opens the edit sub-view', async () => {
    renderProfile(makeMyPlayer())

    await userEvent.click(screen.getByRole('button', { name: 'Edit profile' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/edit')
  })

  describe('agents', () => {
    it('the main agent sees each agent by name and masked email with Main and Pending markers, and can cancel a pending invitation', async () => {
      renderProfile(
        makeMyPlayer({
          agentCount: 2,
          agents: [agent(), agent({ linkId: 'a2', name: 'Sam Smith', maskedEmail: 's***@example.com', main: false, status: 'INVITED' })],
        }),
      )

      const agents = within(screen.getByTestId('my-player-agents'))
      expect(agents.getByText('Priya Naidoo')).toBeInTheDocument()
      expect(agents.getByText('p***@example.com')).toBeInTheDocument()
      expect(agents.getByText('Main')).toBeInTheDocument()
      expect(agents.getByText('Pending')).toBeInTheDocument()

      await userEvent.click(agents.getByRole('button', { name: 'Cancel invitation' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/cancel-invite?link=a2')
    })

    it('the main agent can Hand over or Add another agent', async () => {
      const first = renderProfile(makeMyPlayer({ agentCount: 1, agents: [agent()] }))
      await userEvent.click(screen.getByRole('button', { name: 'Hand over' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/hand-over')
      first.unmount()

      renderProfile(makeMyPlayer({ agentCount: 1, agents: [agent()] }))
      await userEvent.click(screen.getByRole('button', { name: 'Add another agent' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/add-agent')
    })

    it('another agent sees only a count and can Leave, not Hand over or Add', async () => {
      renderProfile(makeMyPlayer({ main: false, canManageAgents: false, agentCount: 2, agents: [] }))

      expect(within(screen.getByTestId('my-player-agents')).getByText('2 agents manage this player.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Hand over' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add another agent' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
      expect(await screen.findByTestId('location')).toHaveTextContent('/account/players/k1/profile/leave')
    })

    it('hides Leave while the caller\'s own link id is not provided', () => {
      renderProfile(makeMyPlayer({ main: false, canManageAgents: false, myLinkId: null }))

      expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
    })

    it('a player\'s own record has no agents block unless they can manage agents, and never a Leave', () => {
      renderProfile(makeMyPlayer({ self: true, canManageAgents: false }))

      expect(screen.queryByTestId('my-player-agents')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument()
    })

    it('uses the singular for one agent', () => {
      renderProfile(makeMyPlayer({ main: false, canManageAgents: false, agentCount: 1 }))

      expect(screen.getByText('1 agent manages this player.')).toBeInTheDocument()
    })
  })
})
