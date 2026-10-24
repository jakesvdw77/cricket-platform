import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import { EditAgentsView as AgentChangeView, RemoveLinkView } from './AgentViews'
import { calls, httpError, renderWithProviders, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { makeMyPlayer } from '../../../test/myPlayerFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 slice 4, "Changing agents": every change has an in-console confirm step and a Back; nothing opens over the console.
const http = api as unknown as ApiMock
const AGENTS = '/me/players/k1/agents'
const player = makeMyPlayer()

beforeEach(() => {
  vi.clearAllMocks()
  routeApi(http, { [`POST ${AGENTS}`]: {}, 'DELETE /me/links/l9': {}, 'DELETE /me/links/my-link': {} })
})

describe('AgentChangeView', () => {
  it('hand over: validates the email, confirms in the console, then sends HANDOVER and says it is pending', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderWithProviders(<AgentChangeView player={player} mode="HANDOVER" />)

    expect(screen.getByRole('heading', { name: 'Hand over Aman' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Email address'))
    await user.type(screen.getByLabelText('Email address'), 'New.Parent@Example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Hand over Aman to new.parent@example.com? You stay an agent until they accept.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls(http.post, AGENTS)).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => expect(calls(http.post, AGENTS)).toHaveLength(1))
    expect(calls(http.post, AGENTS)[0][1]).toEqual({ email: 'new.parent@example.com', mode: 'HANDOVER' })
    expect(await screen.findByText(/Invitation sent to new.parent@example.com. It shows as pending until they accept, and expires after 14 days./)).toBeInTheDocument()
    // The top Back and the one under the confirmation both return to the profile.
    const backs = screen.getAllByRole('button', { name: 'Back to profile' })
    expect(backs).toHaveLength(2)
    await user.click(backs[1])
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('add another agent: sends ADD with its own wording', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AgentChangeView player={player} mode="ADD" />)

    expect(screen.getByRole('heading', { name: 'Add another agent' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), 'second@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add second@example.com as another agent for Aman? They will be sent an invitation.')
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    await waitFor(() => expect(calls(http.post, AGENTS)).toHaveLength(1))
    expect(calls(http.post, AGENTS)[0][1]).toEqual({ email: 'second@example.com', mode: 'ADD' })
  })

  it('Back from the confirm returns to the email step without sending, and Back on the first step leaves', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderWithProviders(<AgentChangeView player={player} mode="HANDOVER" />)

    await user.type(screen.getByLabelText('Email address'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
    expect(calls(http.post, AGENTS)).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Back to profile' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('keeps the confirm step with an error when sending fails', async () => {
    const user = userEvent.setup()
    routeApi(http, { [`POST ${AGENTS}`]: httpError(500) })
    renderWithProviders(<AgentChangeView player={player} mode="ADD" />)

    await user.type(screen.getByLabelText('Email address'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Send invitation' }))

    expect(await screen.findByText('We could not send the invitation. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeEnabled()
  })
})

describe('RemoveLinkView', () => {
  it('cancel pending: confirms in the console, then deletes the invitation link and goes on', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    renderWithProviders(<RemoveLinkView player={player} linkId="l9" kind="cancel" onDone={onDone} />)

    expect(screen.getByRole('heading', { name: 'Cancel invitation' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Cancel this invitation? The invited person will no longer be able to accept it.')
    expect(calls(http.delete, '/me/links/l9')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }))

    await waitFor(() => expect(calls(http.delete, '/me/links/l9')).toHaveLength(1))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
  })

  it('leave: confirms, then deletes the caller\'s own link', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    renderWithProviders(<RemoveLinkView player={player} linkId="my-link" kind="leave" onDone={onDone} />)

    expect(screen.getByRole('heading', { name: 'Leave Aman' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Stop managing Aman? You will no longer see or answer for them, and cannot undo this yourself.')
    await user.click(screen.getByRole('button', { name: 'Yes, leave' }))

    await waitFor(() => expect(calls(http.delete, '/me/links/my-link')).toHaveLength(1))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
  })

  it('tells a main agent with other agents to hand over first (409)', async () => {
    const user = userEvent.setup()
    routeApi(http, { 'DELETE /me/links/my-link': httpError(409) })
    const onDone = vi.fn()
    renderWithProviders(<RemoveLinkView player={player} linkId="my-link" kind="leave" onDone={onDone} />)

    await user.click(screen.getByRole('button', { name: 'Yes, leave' }))

    expect(await screen.findByText('Hand over to another agent first, then you can leave.')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('shows a general error for any other failure', async () => {
    const user = userEvent.setup()
    routeApi(http, { 'DELETE /me/links/l9': httpError(500) })
    renderWithProviders(<RemoveLinkView player={player} linkId="l9" kind="cancel" onDone={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }))

    expect(await screen.findByText('We could not do that. Please try again.')).toBeInTheDocument()
  })

  it('disables the confirm while the link id is unknown, and Back works', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderWithProviders(<RemoveLinkView player={player} linkId={null} kind="leave" onDone={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Yes, leave' })).toBeDisabled()
    await user.click(within(screen.getByTestId('remove-link-view')).getByRole('button', { name: 'Back to profile' }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
