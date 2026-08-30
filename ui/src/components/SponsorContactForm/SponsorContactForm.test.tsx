import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SponsorContactForm, SPONSOR_CONTACT_FORM_ID } from './SponsorContactForm'
import type { SponsorContactFormProps } from './SponsorContactForm'
import type { SponsorContactPayload } from '../../api/sponsorContactApi'

// SponsorContactForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// SponsorContactFormPage) and targets the form via the native `form="…"` attribute — this mirrors
// that wiring so the form's submit behaviour can still be exercised in isolation, same pattern as
// ClubContactForm.test.tsx.
function renderSponsorContactForm(props: SponsorContactFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <SponsorContactForm {...props} />
      <button type="submit" form={SPONSOR_CONTACT_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

// Mirrors ClubContactForm.test.tsx's depth, minus anything photo/MediaUpload-related — this form
// has no photo field (docs/specs/024-sponsor-contacts.md's Non-goals).
describe('SponsorContactForm', () => {
  it('renders inline validation errors for blank required fields and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorContactForm({ onSubmit })

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
    renderSponsorContactForm({ onSubmit })

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a correctly-shaped nested payload once all required fields are filled in', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorContactForm({ onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'Marketing Contact')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as SponsorContactPayload
    expect(payload).toEqual({
      contact: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+27 21 555 0100',
      },
      role: 'Marketing Contact',
      isPrimary: false,
    })
  })

  it('toggling "Is primary contact" is reflected in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorContactForm({ onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'Marketing Contact')
    await user.click(screen.getByLabelText('Is primary contact'))

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as SponsorContactPayload
    expect(payload.isPrimary).toBe(true)
  })

  it('prefills from initialValues, including a nested contact', () => {
    renderSponsorContactForm({
      onSubmit: vi.fn(),
      initialValues: {
        contact: {
          firstName: 'Existing',
          lastName: 'Contact',
          email: 'existing@example.com',
          phone: '+27 21 555 0199',
        },
        role: 'Account Manager',
        isPrimary: true,
      },
    })

    expect(screen.getByLabelText('First name')).toHaveValue('Existing')
    expect(screen.getByLabelText('Last name')).toHaveValue('Contact')
    expect(screen.getByLabelText('Email')).toHaveValue('existing@example.com')
    expect(screen.getByLabelText('Phone')).toHaveValue('+27 21 555 0199')
    expect(screen.getByLabelText('Role')).toHaveValue('Account Manager')
    expect(screen.getByLabelText('Is primary contact')).toBeChecked()
  })
})
