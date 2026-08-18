import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ClubForm, CLUB_FORM_ID } from './ClubForm'
import type { ClubFormProps } from './ClubForm'
import type { ClubPayload } from '../../api/clubApi'

// ClubForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// ClubFormPage) and targets the form via the native `form="…"` attribute — this mirrors that
// wiring so the form's submit behaviour can still be exercised in isolation.
function renderClubForm(props: ClubFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <ClubForm {...props} />
      <button type="submit" form={CLUB_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

describe('ClubForm', () => {
  it('renders the name and slug fields', () => {
    renderClubForm({ onSubmit: vi.fn() })

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toBeInTheDocument()
  })

  it('renders inline validation errors for missing name and slug, and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Slug is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders an inline validation error for a malformed slug, and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Riverside CC')
    await user.type(screen.getByLabelText('Slug'), 'Riverside CC')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(
      await screen.findByText('Use lowercase letters, numbers, and single hyphens, e.g. riverside-cc'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders an inline validation error for a too-short slug, and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'AB Club')
    await user.type(screen.getByLabelText('Slug'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Slug must be between 3 and 63 characters')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a correctly-shaped {name, slug} payload when valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Riverside CC')
    await user.type(screen.getByLabelText('Slug'), 'riverside-cc')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as ClubPayload
    expect(payload).toEqual({ name: 'Riverside CC', slug: 'riverside-cc' })
  })

  it('pre-fills the fields from initialValues in edit mode', () => {
    renderClubForm({
      onSubmit: vi.fn(),
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
    })

    expect(screen.getByLabelText('Name')).toHaveValue('Riverside Cricket Club')
    expect(screen.getByLabelText('Slug')).toHaveValue('riverside-cc')
  })
})
