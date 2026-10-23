import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import { LinkRequestForm } from './LinkRequestForm'
import type { LinkRequestFormProps } from './LinkRequestForm'
import { calls, httpError, renderWithProviders, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 Part 3 (3B): the typed request always carries a contact number and the full date of birth.
const http = api as unknown as ApiMock
const CLUBS = [{ id: 'c1', name: 'Riverside CC' }, { id: 'c2', name: 'Hillcrest CC' }]

function renderForm(props: Partial<LinkRequestFormProps> = {}, clubs = CLUBS, post: unknown = { message: 'ok' }) {
  routeApi(http, { 'GET /me/clubs': clubs, 'POST /me/link-requests': post })
  const onSent = vi.fn()
  renderWithProviders(<LinkRequestForm onSent={onSent} {...props} />)
  return onSent
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Aman')
  await user.type(screen.getByLabelText('Surname'), 'Naidoo')
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2012-03-04' } })
  await user.type(screen.getByLabelText('Contact number'), '082 555 0100')
}

const chooseClub = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('combobox', { name: 'Club' }))
  await user.click(await screen.findByRole('option', { name }))
}

beforeEach(() => vi.clearAllMocks())

describe('LinkRequestForm', () => {
  it('shows a message on every missing required field and sends nothing', async () => {
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: 'Club' })

    await user.click(screen.getByRole('button', { name: 'Send request' }))

    for (const text of ["Enter the player's first name", "Enter the player's surname", 'Enter the full date of birth', 'Enter a contact number', 'Choose the club']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(calls(http.post, '/me/link-requests')).toHaveLength(0)
  })

  it('requires the contact number even when everything else is filled in', async () => {
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: 'Club' })
    await user.type(screen.getByLabelText('First name'), 'Aman')
    await user.type(screen.getByLabelText('Surname'), 'Naidoo')
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2012-03-04' } })
    await chooseClub(user, 'Hillcrest CC')

    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(screen.getByText('Enter a contact number')).toBeInTheDocument()
    expect(calls(http.post, '/me/link-requests')).toHaveLength(0)
  })

  it('sends the full date of birth, the contact number and the chosen club, then reports it sent', async () => {
    const user = userEvent.setup()
    const onSent = renderForm()
    await fillRequired(user)
    await chooseClub(user, 'Hillcrest CC')
    await user.type(screen.getByLabelText('Message (optional)'), 'Under 14 coach is Mr Smith')

    await user.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(onSent).toHaveBeenCalledOnce())
    expect(calls(http.post, '/me/link-requests')[0][1]).toEqual({
      clubId: 'c2',
      firstName: 'Aman',
      lastName: 'Naidoo',
      dateOfBirth: '2012-03-04',
      contactNumber: '082 555 0100',
      message: 'Under 14 coach is Mr Smith',
    })
  })

  it('preselects the only club', async () => {
    const user = userEvent.setup()
    renderForm({}, [CLUBS[0]])
    await fillRequired(user)
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Club' })).toHaveTextContent('Riverside CC'))

    await user.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(calls(http.post, '/me/link-requests')).toHaveLength(1))
    expect(calls(http.post, '/me/link-requests')[0][1]).toMatchObject({ clubId: 'c1' })
  })

  it('prefills the first name, hints at the surname initial, selects the matched club and sends the target ref', async () => {
    const user = userEvent.setup()
    renderForm({ prefill: { firstName: 'Zane', surnameInitial: 'b', clubId: 'c2', clubName: 'Hillcrest CC', targetPlayerRef: 'ref-9' } })

    expect(screen.getByLabelText('First name')).toHaveValue('Zane')
    expect(screen.getByLabelText('Surname')).toHaveValue('')
    expect(screen.getByText('Starts with B')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Club' })).toHaveTextContent('Hillcrest CC'))
    await user.type(screen.getByLabelText('Surname'), 'Botha')
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2010-05-06' } })
    await user.type(screen.getByLabelText('Contact number'), '0825550100')

    await user.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(calls(http.post, '/me/link-requests')).toHaveLength(1))
    expect(calls(http.post, '/me/link-requests')[0][1]).toMatchObject({ clubId: 'c2', targetPlayerRef: 'ref-9' })
  })

  it('shows a Back button when the form was opened from somewhere to return to', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderForm({ onBack })
    await user.click(await screen.findByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('has no Back button without onBack', async () => {
    renderForm()
    await screen.findByRole('combobox', { name: 'Club' })
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('explains a rate limit and a general failure differently', async () => {
    const user = userEvent.setup()
    renderForm({}, [CLUBS[0]], httpError(429))
    await fillRequired(user)
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Club' })).toHaveTextContent('Riverside CC'))
    await user.click(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText('You have sent too many requests. Please try again later.')).toBeInTheDocument()

    routeApi(http, { 'GET /me/clubs': [CLUBS[0]], 'POST /me/link-requests': httpError(500) })
    await user.click(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText('We could not send your request. Please try again.')).toBeInTheDocument()
  })
})
