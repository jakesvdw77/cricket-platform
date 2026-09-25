import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { LeagueForm, LEAGUE_FORM_ID } from './LeagueForm'
import type { LeagueFormProps } from './LeagueForm'
import type { LeaguePayload } from '../../api/leagueApi'

const uploadMedia = vi.fn()
const uploadManagedMedia = vi.fn()

// LeagueForm's Branding tab renders the real MediaUpload component (namespace="manage") for
// Logo — mocking mediaApi's two exports here mirrors SponsorForm.test.tsx's identical setup, so
// the namespace wiring is proved for real rather than just asserting a prop was passed.
vi.mock('../../api/mediaApi', () => ({
  uploadMedia: (file: File) => uploadMedia(file),
  uploadManagedMedia: (file: File) => uploadManagedMedia(file),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function renderLeagueForm(props: LeagueFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <LeagueForm {...props} />
      <button type="submit" form={LEAGUE_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

const populatedValues: Partial<LeaguePayload> = {
  name: 'Existing League',
  maxPlayingXiSize: 12,
  minAge: 13,
  maxAge: 15,
  ageCutoffDate: '2026-12-31',
  format: 'T20',
  phone: '+27 21 555 0177',
  website: 'https://riverside.example.com',
  email: 'league@riverside.example.com',
  logoUrl: '/media/managed/league-logo.png',
  socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-league' }],
}

describe('LeagueForm', () => {
  it('renders all three tabs, none disabled, and all reachable, when created fresh (no initialValues)', async () => {
    const user = userEvent.setup()
    renderLeagueForm({ onSubmit: vi.fn() })

    expect(screen.getByRole('tab', { name: 'Basic Info' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Branding' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Social Media' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Basic Info' })).not.toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Branding' })).not.toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Social Media' })).not.toBeDisabled()

    // Basic Info is the default tab.
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Playing XI size')).toHaveValue(11)

    await user.click(screen.getByRole('tab', { name: 'Branding' }))
    expect(screen.getByText('Logo')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()
  })

  it('does not render a League.source picker', () => {
    renderLeagueForm({ onSubmit: vi.fn() })
    expect(screen.queryByLabelText(/^source$/i)).not.toBeInTheDocument()
  })

  it('prefills the Basic Info tab from initialValues, including the new profile fields', async () => {
    const user = userEvent.setup()
    renderLeagueForm({ onSubmit: vi.fn(), initialValues: populatedValues })

    expect(screen.getByLabelText('Name')).toHaveValue('Existing League')
    expect(screen.getByLabelText('Playing XI size')).toHaveValue(12)
    expect(screen.getByLabelText('Format')).toHaveTextContent('T20')
    expect(screen.getByLabelText('Phone')).toHaveValue('+27 21 555 0177')
    expect(screen.getByLabelText('Website')).toHaveValue('https://riverside.example.com')
    expect(screen.getByLabelText('Email')).toHaveValue('league@riverside.example.com')

    await user.click(screen.getByRole('tab', { name: 'Branding' }))
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByDisplayValue('https://facebook.com/riverside-league')).toBeInTheDocument()
  })

  it('renders an inline validation error for a blank name and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    // Navigate away from Basic Info first, so the tab-switch-on-error behaviour is actually
    // exercised rather than a no-op.
    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByRole('tab', { name: 'Social Media' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Basic Info' })).toHaveAttribute('aria-selected', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects minAge > maxAge client-side, mirroring the server rule', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.type(screen.getByLabelText('Min age'), '50')
    await user.type(screen.getByLabelText('Max age'), '40')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Min age must be less than or equal to max age')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders a validation error for a malformed website submitted before the field is blurred (so WebsiteInput has not yet normalized it)', async () => {
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Vets League' } })
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'not a url' } })
    fireEvent.submit(screen.getByLabelText('Website').closest('form') as HTMLFormElement)

    expect(await screen.findByText('Enter a valid website URL, e.g. https://example.com')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validates a malformed Email only when non-blank, and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Email'))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('submits a full payload, defaulting unset age fields and profile fields to null/empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload).toEqual({
      name: 'Vets League',
      maxPlayingXiSize: 11,
      minAge: null,
      maxAge: null,
      ageCutoffDate: null,
      format: null,
      phone: null,
      website: null,
      email: null,
      logoUrl: null,
      socialLinks: [],
    })
  })

  it('submits min/max age, cutoff date, and format when provided', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'U15 League')
    await user.clear(screen.getByLabelText('Playing XI size'))
    await user.type(screen.getByLabelText('Playing XI size'), '11')
    await user.type(screen.getByLabelText('Min age'), '13')
    await user.type(screen.getByLabelText('Max age'), '15')
    await user.type(screen.getByLabelText('Age cutoff date'), '2026-12-31')
    await user.click(screen.getByLabelText('Format'))
    await user.click(await screen.findByRole('option', { name: '1 Day' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload).toEqual({
      name: 'U15 League',
      maxPlayingXiSize: 11,
      minAge: 13,
      maxAge: 15,
      ageCutoffDate: '2026-12-31',
      format: 'ONE_DAY',
      phone: null,
      website: null,
      email: null,
      logoUrl: null,
      socialLinks: [],
    })
  })

  it('uploads a logo via the manage-namespace endpoint and includes the resulting URL in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/league-logo.png' })
    renderLeagueForm({ onSubmit })

    await user.click(screen.getByRole('tab', { name: 'Branding' }))

    const logoFile = new File(['logo'], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Logo file'), logoFile)
    await screen.findByRole('button', { name: 'Replace' })

    // LeagueForm passes namespace="manage" to MediaUpload — the manage-scoped upload function is
    // called, never the platform one a CLUB_ADMIN can't reach.
    expect(uploadManagedMedia).toHaveBeenCalledWith(logoFile)
    expect(uploadMedia).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: 'Basic Info' }))
    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload.logoUrl).toBe('/media/managed/league-logo.png')
  })

  it('wires the Social Media tab to SocialLinksFields, including an added link in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add link' }))
    await user.type(screen.getByLabelText('URL'), 'https://facebook.com/riverside-league')

    await user.click(screen.getByRole('tab', { name: 'Basic Info' }))
    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload.socialLinks).toEqual([{ platform: 'facebook', url: 'https://facebook.com/riverside-league' }])
  })
})
