import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ClubContactForm, CLUB_CONTACT_FORM_ID } from './ClubContactForm'
import type { ClubContactFormProps } from './ClubContactForm'
import type { ClubContactPayload } from '../../api/clubContactApi'

const uploadMedia = vi.fn()
const uploadManagedMedia = vi.fn()

// ClubContactForm's Photo field renders the real MediaUpload component (namespace="manage") —
// mocking mediaApi's two exports here (same shape as MediaUpload.test.tsx) proves the namespace
// wiring for real, rather than mocking MediaUpload itself and just asserting a prop was passed.
vi.mock('../../api/mediaApi', () => ({
  uploadMedia: (file: File) => uploadMedia(file),
  uploadManagedMedia: (file: File) => uploadManagedMedia(file),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ClubContactForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// ClubContactFormPage) and targets the form via the native `form="…"` attribute — this mirrors
// that wiring so the form's submit behaviour can still be exercised in isolation, same pattern
// as ProductForm.test.tsx/ClubForm.test.tsx.
function renderClubContactForm(props: ClubContactFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <ClubContactForm {...props} />
      <button type="submit" form={CLUB_CONTACT_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

describe('ClubContactForm', () => {
  it('renders inline validation errors for blank required fields and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubContactForm({ onSubmit })

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
    renderClubContactForm({ onSubmit })

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a correctly-shaped nested payload once all required fields are filled in', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubContactForm({ onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'Chairman')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ClubContactPayload
    expect(payload).toEqual({
      contact: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+27 21 555 0100',
      },
      role: 'Chairman',
      isPrimary: false,
      photoUrl: null,
    })
  })

  it('toggling "Is primary contact" is reflected in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubContactForm({ onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'Chairman')
    await user.click(screen.getByLabelText('Is primary contact'))

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ClubContactPayload
    expect(payload.isPrimary).toBe(true)
  })

  it('uploads a photo via the manage-namespace endpoint and includes the resulting URL in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/contact-photo.png' })
    renderClubContactForm({ onSubmit })

    const file = new File(['photo'], 'photo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Photo file'), file)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument())
    // ClubContactForm passes namespace="manage" to MediaUpload — the manage-scoped upload
    // function is called, never the platform one a CLUB_ADMIN can't reach.
    expect(uploadManagedMedia).toHaveBeenCalledWith(file)
    expect(uploadMedia).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('First name'), 'Jane')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Email'), 'jane.smith@example.com')
    await user.type(screen.getByLabelText('Phone'), '+27 21 555 0100')
    await user.type(screen.getByLabelText('Role'), 'Chairman')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ClubContactPayload
    expect(payload.photoUrl).toBe('/media/managed/contact-photo.png')
  })

  it('prefills from initialValues, including a nested contact and an existing photo', () => {
    renderClubContactForm({
      onSubmit: vi.fn(),
      initialValues: {
        contact: {
          firstName: 'Existing',
          lastName: 'Contact',
          email: 'existing@example.com',
          phone: '+27 21 555 0199',
        },
        role: 'Treasurer',
        isPrimary: true,
        photoUrl: '/media/managed/existing.png',
      },
    })

    expect(screen.getByLabelText('First name')).toHaveValue('Existing')
    expect(screen.getByLabelText('Last name')).toHaveValue('Contact')
    expect(screen.getByLabelText('Email')).toHaveValue('existing@example.com')
    expect(screen.getByLabelText('Phone')).toHaveValue('+27 21 555 0199')
    expect(screen.getByLabelText('Role')).toHaveValue('Treasurer')
    expect(screen.getByLabelText('Is primary contact')).toBeChecked()
    expect(screen.getByRole('img', { name: 'Photo preview' })).toHaveAttribute('src', '/media/managed/existing.png')
  })
})
