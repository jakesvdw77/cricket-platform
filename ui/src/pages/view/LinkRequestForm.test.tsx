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

const SECTIONS = [{ id: 's1', name: 'Under 14' }, { id: 's2', name: 'Under 16' }]

function renderForm(props: Partial<LinkRequestFormProps> = {}, clubs = CLUBS, post: unknown = { message: 'ok' }, sections: Record<string, unknown> = {}) {
  routeApi(http, { 'GET /me/clubs': clubs, 'POST /me/link-requests': post, ...sections })
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

  describe('section (docs/specs/121)', () => {
    const sectionsFor = (c1: unknown = SECTIONS, c2: unknown = []) => ({ 'GET /me/clubs/c1/sections': c1, 'GET /me/clubs/c2/sections': c2 })
    const sectionBox = () => screen.getByRole('combobox', { name: /^Section/ })

    it('is disabled with "Choose a club first" until a club is chosen, then loads the club\'s sections', async () => {
      const user = userEvent.setup()
      renderForm({}, CLUBS, undefined, sectionsFor())
      await screen.findByRole('combobox', { name: 'Club' })

      expect(sectionBox()).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByText('Choose a club first')).toBeInTheDocument()
      expect(calls(http.get, '/me/clubs/c1/sections')).toHaveLength(0)

      await chooseClub(user, 'Riverside CC')
      await waitFor(() => expect(sectionBox()).not.toHaveAttribute('aria-disabled', 'true'))
      await user.click(sectionBox())
      expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Under 14', 'Under 16'])
      expect(screen.queryByText('Choose a club first')).not.toBeInTheDocument()
    })

    it('clears the chosen section when the club changes', async () => {
      const user = userEvent.setup()
      renderForm({}, CLUBS, undefined, sectionsFor(SECTIONS, [{ id: 's9', name: 'Seniors' }]))
      await chooseClub(user, 'Riverside CC')
      await waitFor(() => expect(sectionBox()).not.toHaveAttribute('aria-disabled', 'true'))
      await user.click(sectionBox())
      await user.click(await screen.findByRole('option', { name: 'Under 16' }))
      expect(sectionBox()).toHaveTextContent('Under 16')

      await user.click(screen.getByRole('combobox', { name: 'Club' }))
      await user.click(await screen.findByRole('option', { name: 'Hillcrest CC' }))

      await waitFor(() => expect(sectionBox()).not.toHaveTextContent('Under 16'))
      await waitFor(() => expect(calls(http.get, '/me/clubs/c2/sections')).toHaveLength(1))
    })

    it('is required with "Choose the section" when the club has sections, and sends nothing without it', async () => {
      const user = userEvent.setup()
      renderForm({}, [CLUBS[0]], undefined, sectionsFor())
      await fillRequired(user)
      await waitFor(() => expect(sectionBox()).not.toHaveAttribute('aria-disabled', 'true'))

      await user.click(screen.getByRole('button', { name: 'Send request' }))

      expect(screen.getByText('Choose the section')).toBeInTheDocument()
      expect(sectionBox()).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Section' })).toBeInTheDocument()
      expect(calls(http.post, '/me/link-requests')).toHaveLength(0)
    })

    it('sends sectionId in the payload once chosen', async () => {
      const user = userEvent.setup()
      const onSent = renderForm({}, [CLUBS[0]], undefined, sectionsFor())
      await fillRequired(user)
      await waitFor(() => expect(sectionBox()).not.toHaveAttribute('aria-disabled', 'true'))
      await user.click(sectionBox())
      await user.click(await screen.findByRole('option', { name: 'Under 16' }))

      await user.click(screen.getByRole('button', { name: 'Send request' }))

      await waitFor(() => expect(onSent).toHaveBeenCalledOnce())
      expect(calls(http.post, '/me/link-requests')[0][1]).toMatchObject({ clubId: 'c1', sectionId: 's2' })
    })

    it('is optional, labelled so, when asking about a matched player, and a request without it is sent', async () => {
      const user = userEvent.setup()
      const onSent = renderForm({ prefill: { firstName: 'Zane', clubId: 'c1', targetPlayerRef: 'ref-9' } }, CLUBS, undefined, sectionsFor())
      await user.type(screen.getByLabelText('Surname'), 'Botha')
      fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2010-05-06' } })
      await user.type(screen.getByLabelText('Contact number'), '0825550100')
      expect(await screen.findByRole('combobox', { name: 'Section (optional)' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Send request' }))

      await waitFor(() => expect(onSent).toHaveBeenCalledOnce())
      expect(screen.queryByText('Choose the section')).not.toBeInTheDocument()
      expect(calls(http.post, '/me/link-requests')[0][1]).not.toHaveProperty('sectionId')
    })

    it('is hidden when the club has no sections, and the request is sent without one', async () => {
      const user = userEvent.setup()
      const onSent = renderForm({}, [CLUBS[0]], undefined, sectionsFor([]))
      await fillRequired(user)
      await waitFor(() => expect(calls(http.get, '/me/clubs/c1/sections')).toHaveLength(1))
      await waitFor(() => expect(screen.queryByRole('combobox', { name: /^Section/ })).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Send request' }))

      await waitFor(() => expect(onSent).toHaveBeenCalledOnce())
      expect(calls(http.post, '/me/link-requests')[0][1]).not.toHaveProperty('sectionId')
    })

    it('lets the message field span both columns', async () => {
      renderForm()
      await screen.findByRole('combobox', { name: 'Club' })

      // jsdom does not compute grid shorthands, so read the rule emotion injected for the field's class.
      const field = screen.getByLabelText('Message (optional)').closest('.MuiTextField-root') as HTMLElement
      const cls = Array.from(field.classList).find((name) => name.startsWith('css-')) as string
      const css = Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules).map((r) => r.cssText)).join('\n')
      expect(css.split('}').find((chunk) => chunk.includes(`.${cls}`) && chunk.includes('grid-column'))).toMatch(/grid-column:\s*1\s*\/\s*-1/)
    })
  })
})
