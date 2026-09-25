import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LeagueContactForm, LEAGUE_CONTACT_FORM_ID } from './LeagueContactForm'
import type { LeagueContactFormProps } from './LeagueContactForm'
import type { LeagueContactPayload } from '../../api/leagueContactApi'

// LeagueContactForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// LeagueContactFormPage) and targets the form via the native `form="…"` attribute — this mirrors
// that wiring so the form's submit behaviour can still be exercised in isolation, same pattern as
// SponsorContactForm.test.tsx.
function renderLeagueContactForm(props: LeagueContactFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <LeagueContactForm {...props} />
      <button type="submit" form={LEAGUE_CONTACT_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

// Mirrors SponsorContactForm.test.tsx's depth, minus anything photo/MediaUpload-related — this
// form has no photo field (docs/specs/054-league-contacts.md's Non-goals).
describe('LeagueContactForm', () => {
  it('renders inline validation errors for blank required fields and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueContactForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Phone is required')).toBeInTheDocument()
    expect(screen.getByText('Role is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders an inline validation error for a malformed email, and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueContactForm({ onSubmit })

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a correctly-shaped nested payload once all required fields are filled in', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueContactForm({ onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'League Administrator')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as LeagueContactPayload
    expect(payload).toEqual({
      contact: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+27 21 555 0100',
      },
      role: 'League Administrator',
      isPrimary: false,
    })
  })

  it('toggling "Is primary contact" is reflected in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueContactForm({ onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'League Administrator')
    await user.click(screen.getByLabelText('Is primary contact'))

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as LeagueContactPayload
    expect(payload.isPrimary).toBe(true)
  })

  it('prefills from initialValues, including a nested contact', () => {
    renderLeagueContactForm({
      onSubmit: vi.fn(),
      initialValues: {
        contact: {
          firstName: 'Existing',
          lastName: 'Contact',
          email: 'existing@example.com',
          phone: '+27 21 555 0199',
        },
        role: 'Umpire Coordinator',
        isPrimary: true,
      },
    })

    expect(screen.getByLabelText('First name')).toHaveValue('Existing')
    expect(screen.getByLabelText('Last name')).toHaveValue('Contact')
    expect(screen.getByLabelText('Email')).toHaveValue('existing@example.com')
    expect(screen.getByLabelText('Phone')).toHaveValue('+27 21 555 0199')
    expect(screen.getByLabelText('Role')).toHaveValue('Umpire Coordinator')
    expect(screen.getByLabelText('Is primary contact')).toBeChecked()
  })
})
