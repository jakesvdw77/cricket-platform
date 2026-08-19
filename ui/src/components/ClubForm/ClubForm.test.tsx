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
    // Slug auto-fills from Name (see the auto-derive tests below) — clear it first to exercise
    // an explicit, deliberately malformed manual entry rather than appending to the derived value.
    await user.clear(screen.getByLabelText('Slug'))
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
    await user.clear(screen.getByLabelText('Slug'))
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
    await user.clear(screen.getByLabelText('Slug'))
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

  it('auto-derives the slug from the name as the admin types, until the slug is manually edited', async () => {
    const user = userEvent.setup()
    renderClubForm({ onSubmit: vi.fn() })

    await user.type(screen.getByLabelText('Name'), 'Riverside Cricket Club!')

    expect(screen.getByLabelText('Slug')).toHaveValue('riverside-cricket-club')
    expect(screen.getByText('Auto-filled from name — edit to override')).toBeInTheDocument()

    // Once the admin edits the slug directly, further Name edits must not clobber it.
    await user.clear(screen.getByLabelText('Slug'))
    await user.type(screen.getByLabelText('Slug'), 'my-custom-slug')
    await user.type(screen.getByLabelText('Name'), ' Extra')

    expect(screen.getByLabelText('Slug')).toHaveValue('my-custom-slug')
  })

  it('edit mode never auto-derives the slug from the name, since a club already has one', async () => {
    const user = userEvent.setup()
    renderClubForm({
      onSubmit: vi.fn(),
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
    })

    await user.type(screen.getByLabelText('Name'), ' Renamed')

    expect(screen.getByLabelText('Slug')).toHaveValue('riverside-cc')
  })
})
