import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { MyPlayer } from '../../../api/myPlayersApi'
import { MyPlayerEditForm } from './MyPlayerEditForm'
import { calls, httpError, renderWithProviders, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { makeMyPlayer } from '../../../test/myPlayerFixtures'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/119 3C, Decisions 16 and 20: what an agent may change, and the date of birth warning that gates Save.
const http = api as unknown as ApiMock
const PUT = '/me/players/k1'

function renderForm(player: MyPlayer, props: { dark?: boolean; onBack?: () => void } = {}) {
  routeApi(http, { [`PUT ${PUT}`]: player })
  const onDone = vi.fn()
  renderWithProviders(<MyPlayerEditForm player={player} onDone={onDone} {...props} />)
  return onDone
}

const dob = () => screen.getByLabelText('Date of birth') as HTMLInputElement
const save = () => screen.getByRole('button', { name: 'Save changes' })

beforeEach(() => vi.clearAllMocks())

describe('MyPlayerEditForm date of birth', () => {
  it('changing it shows the warning and Save stays disabled until I understand is ticked', async () => {
    const user = userEvent.setup()
    const onDone = renderForm(makeMyPlayer({ canEditDateOfBirth: true }), { dark: true, onBack: vi.fn() })

    expect(screen.queryByTestId('dob-warning')).not.toBeInTheDocument()
    expect(save()).toBeEnabled()

    fireEvent.change(dob(), { target: { value: '2011-03-04' } })

    expect(screen.getByTestId('dob-warning')).toHaveTextContent('Changing the date of birth can change which age group and sections Aman is eligible for')
    expect(screen.getByTestId('dob-warning')).toHaveTextContent('applies at every club Aman plays for')
    expect(save()).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'I understand' }))
    expect(save()).toBeEnabled()
    await user.click(save())

    await waitFor(() => expect(calls(http.put, PUT)).toHaveLength(1))
    expect(calls(http.put, PUT)[0][1]).toMatchObject({ dateOfBirth: '2011-03-04' })
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
  })

  it('changing it back to the stored value removes the warning and re-enables Save', () => {
    renderForm(makeMyPlayer())

    fireEvent.change(dob(), { target: { value: '2011-03-04' } })
    expect(save()).toBeDisabled()
    fireEvent.change(dob(), { target: { value: '2012-03-04' } })

    expect(screen.queryByTestId('dob-warning')).not.toBeInTheDocument()
    expect(save()).toBeEnabled()
  })

  it('is read only with an explanation when the caller cannot edit it, and the stored value is echoed back', async () => {
    const user = userEvent.setup()
    renderForm(makeMyPlayer({ canEditDateOfBirth: false }))

    expect(dob()).toBeDisabled()
    expect(dob()).toHaveValue('2012-03-04')
    expect(screen.getByText('Only the main agent or the adult player can change this')).toBeInTheDocument()

    await user.click(save())

    await waitFor(() => expect(calls(http.put, PUT)).toHaveLength(1))
    expect(calls(http.put, PUT)[0][1]).toMatchObject({ dateOfBirth: '2012-03-04' })
  })

  it('refuses a date in the future without calling the server', async () => {
    const user = userEvent.setup()
    renderForm(makeMyPlayer())

    fireEvent.change(dob(), { target: { value: '2999-01-01' } })
    await user.click(screen.getByRole('checkbox', { name: 'I understand' }))
    await user.click(save())

    expect(await screen.findByText('The date of birth cannot be in the future')).toBeInTheDocument()
    expect(calls(http.put, PUT)).toHaveLength(0)
  })
})

describe('MyPlayerEditForm for an agent who is not the main agent (Decision 20)', () => {
  const other = () => makeMyPlayer({ main: false, self: false, canEditMedical: false, canEditDateOfBirth: false, email: 'aman@example.com', medicalAidProvider: 'Discovery', medicalAidMemberNumber: 'D-1234' })

  it('shows email and medical aid as read only', () => {
    renderForm(other())

    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByText('Only the main agent can change this')).toBeInTheDocument()
    expect(screen.getByLabelText('Medical aid provider')).toBeDisabled()
    expect(screen.getByLabelText('Medical aid member number')).toBeDisabled()
    expect(screen.getByText('Only the main agent or the player can change medical aid details.')).toBeInTheDocument()
  })

  it('sends the stored email and medical aid back unchanged while a contact change goes through', async () => {
    const user = userEvent.setup()
    renderForm(other())

    const alt = screen.getByLabelText('Alternative contact name')
    await user.clear(alt)
    await user.type(alt, 'New Contact')
    await user.click(save())

    await waitFor(() => expect(calls(http.put, PUT)).toHaveLength(1))
    expect(calls(http.put, PUT)[0][1]).toMatchObject({
      email: 'aman@example.com',
      medicalAidProvider: 'Discovery',
      medicalAidMemberNumber: 'D-1234',
      altContactName: 'New Contact',
    })
  })

  it('the main agent can edit them and a blank clears the value', async () => {
    const user = userEvent.setup()
    renderForm(makeMyPlayer({ main: true }))

    await user.clear(screen.getByLabelText('Medical aid provider'))
    await user.click(save())

    await waitFor(() => expect(calls(http.put, PUT)).toHaveLength(1))
    expect(calls(http.put, PUT)[0][1]).toMatchObject({ medicalAidProvider: null, medicalAidMemberNumber: 'D-1234' })
    expect(screen.getByLabelText('Email')).toBeEnabled()
  })
})

describe('MyPlayerEditForm saving and leaving', () => {
  it('validates the email format', async () => {
    const user = userEvent.setup()
    renderForm(makeMyPlayer())

    const email = screen.getByLabelText('Email')
    await user.clear(email)
    await user.type(email, 'not-an-email')
    await user.click(save())

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(calls(http.put, PUT)).toHaveLength(0)
  })

  it('explains a refused change (403) and any other failure differently', async () => {
    const user = userEvent.setup()
    renderForm(makeMyPlayer())
    routeApi(http, { [`PUT ${PUT}`]: httpError(403) })
    await user.click(save())
    expect(await screen.findByText('You cannot change that detail for this player.')).toBeInTheDocument()

    routeApi(http, { [`PUT ${PUT}`]: httpError(500) })
    await user.click(save())
    expect(await screen.findByText('We could not save the changes. Please try again.')).toBeInTheDocument()
  })

  it('the dark form has Back to profile, asking to discard only when something changed', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    renderForm(makeMyPlayer(), { dark: true, onBack })

    await user.click(screen.getByRole('button', { name: 'Back to profile' }))
    expect(onBack).toHaveBeenCalledTimes(1)

    await user.type(screen.getByLabelText('Alternative contact name'), 'x')
    await user.click(screen.getByRole('button', { name: 'Back to profile' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Discard your changes?')
    expect(onBack).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to profile' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onBack).toHaveBeenCalledTimes(2)
  })
})
