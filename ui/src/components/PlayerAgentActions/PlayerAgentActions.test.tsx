import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { PlayerLink } from '../../api/playerAccountsApi'
import { PlayerAgentActions } from './PlayerAgentActions'
import { calls, httpError, renderWithProviders, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 slice 4 (Decision 26): invite as main, make main and remove each need a confirm and send confirm: true.
const http = api as unknown as ApiMock
const LINKS = '/manage/clubs/c1/players/p1/links'
const link = (overrides: Partial<PlayerLink>): PlayerLink => ({
  linkId: 'l1',
  agentName: 'Priya Naidoo',
  maskedEmail: 'p***@example.com',
  main: true,
  status: 'ACTIVE',
  grantedVia: 'EMAIL_MATCH',
  since: '2026-01-01',
  ...overrides,
})
const OTHER = link({ linkId: 'l2', agentName: 'Sam Second', maskedEmail: 's***@example.com', main: false })

function renderActions(links: PlayerLink[], extra: Record<string, unknown> = {}) {
  routeApi(http, {
    [`GET ${LINKS}`]: links,
    [`POST ${LINKS}`]: {},
    [`POST ${LINKS}/l2/make-main`]: {},
    [`DELETE ${LINKS}/l2`]: {},
    ...extra,
  })
  return renderWithProviders(<PlayerAgentActions clubId="c1" playerId="p1" playerName="Aman Naidoo" />)
}

describe('PlayerAgentActions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the agents with Main agent and Pending markers, offering Make main only for an active non-main agent', async () => {
    renderActions([link({}), OTHER, link({ linkId: 'l3', agentName: 'Pending Pat', main: false, status: 'INVITED' })])

    expect(await screen.findByText('Priya Naidoo')).toBeInTheDocument()
    expect(screen.getByText('Main agent')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Make main agent' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Remove link' })).toHaveLength(3)
  })

  it('shows the empty line when no agents are linked', async () => {
    renderActions([])
    expect(await screen.findByText('No agents are linked to Aman Naidoo.')).toBeInTheDocument()
  })

  it('renders nothing when the links cannot be read', async () => {
    renderActions([], { [`GET ${LINKS}`]: httpError(403) })
    await waitFor(() => expect(http.get).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('player-agent-actions')).not.toBeInTheDocument())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  describe('invite as main agent', () => {
    it('validates the email, asks for a confirm and then sends the invite with confirm: true', async () => {
      const user = userEvent.setup()
      renderActions([link({})])
      const field = await screen.findByLabelText('Invite an email as main agent')

      await user.type(field, 'not-an-email')
      await user.click(screen.getByRole('button', { name: 'Invite as main agent' }))
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.clear(field)
      await user.type(field, 'New.Agent@Example.com')
      await user.click(screen.getByRole('button', { name: 'Invite as main agent' }))
      const dialog = await screen.findByRole('dialog', { name: 'Invite as main agent?' })
      expect(dialog).toHaveTextContent('new.agent@example.com will be invited to manage Aman Naidoo as main agent')
      expect(calls(http.post, LINKS)).toHaveLength(0)

      await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }))

      await waitFor(() => expect(calls(http.post, LINKS)).toHaveLength(1))
      expect(calls(http.post, LINKS)[0][1]).toEqual({ email: 'new.agent@example.com', confirm: true })
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(field).toHaveValue('')
    })

    it('Cancel sends nothing', async () => {
      const user = userEvent.setup()
      renderActions([link({})])

      await user.type(await screen.findByLabelText('Invite an email as main agent'), 'a@b.co')
      await user.click(screen.getByRole('button', { name: 'Invite as main agent' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(calls(http.post, LINKS)).toHaveLength(0)
    })

    it('keeps the dialog open with an error when the server refuses', async () => {
      const user = userEvent.setup()
      renderActions([link({})], { [`POST ${LINKS}`]: httpError(409) })

      await user.type(await screen.findByLabelText('Invite an email as main agent'), 'a@b.co')
      await user.click(screen.getByRole('button', { name: 'Invite as main agent' }))
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send invitation' }))

      expect(await screen.findByText('We could not make that change. Please try again.')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('Make main agent confirms first, then posts make-main with confirm: true', async () => {
    const user = userEvent.setup()
    renderActions([link({}), OTHER])

    await user.click(await screen.findByRole('button', { name: 'Make main agent' }))
    const dialog = await screen.findByRole('dialog', { name: 'Make main agent?' })
    expect(dialog).toHaveTextContent('Sam Second becomes the main agent for Aman Naidoo.')
    expect(calls(http.post, `${LINKS}/l2/make-main`)).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Make main agent' }))

    await waitFor(() => expect(calls(http.post, `${LINKS}/l2/make-main`)).toHaveLength(1))
    expect(calls(http.post, `${LINKS}/l2/make-main`)[0][1]).toEqual({ confirm: true })
  })

  it('Remove link confirms first, then deletes with confirm: true', async () => {
    const user = userEvent.setup()
    renderActions([link({}), OTHER])

    const row = (await screen.findByText('Sam Second')).closest('div[class*="MuiBox-root"]')?.parentElement as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Remove link' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove this link?' })
    expect(dialog).toHaveTextContent('Sam Second will no longer see or manage Aman Naidoo. Their access ends at once.')
    expect(calls(http.delete, `${LINKS}/l2`)).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Remove link' }))

    await waitFor(() => expect(calls(http.delete, `${LINKS}/l2`)).toHaveLength(1))
    expect(calls(http.delete, `${LINKS}/l2`)[0][1]).toEqual({ params: { confirm: true } })
  })
})
