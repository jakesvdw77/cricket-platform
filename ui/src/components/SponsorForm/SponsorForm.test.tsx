import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SponsorForm, SPONSOR_FORM_ID } from './SponsorForm'
import type { SponsorFormProps } from './SponsorForm'
import type { SponsorPayload } from '../../api/sponsorApi'

const uploadMedia = vi.fn()
const uploadManagedMedia = vi.fn()

// SponsorForm's Branding tab renders the real MediaUpload component (namespace="manage") for
// both Logo and Banner — mocking mediaApi's two exports here (same shape as
// ClubContactForm.test.tsx) proves the namespace wiring for real, rather than mocking
// MediaUpload itself and just asserting a prop was passed.
vi.mock('../../api/mediaApi', () => ({
  uploadMedia: (file: File) => uploadMedia(file),
  uploadManagedMedia: (file: File) => uploadManagedMedia(file),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// SponsorForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// SponsorFormPage) and targets the form via the native `form="…"` attribute — this mirrors that
// wiring so the form's submit behaviour can still be exercised in isolation, same pattern as
// ClubContactForm.test.tsx/ClubForm.test.tsx.
function renderSponsorForm(props: SponsorFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <SponsorForm {...props} />
      <button type="submit" form={SPONSOR_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

const populatedValues: Partial<SponsorPayload> = {
  name: 'Riverside Hardware',
  website: 'https://riverside-hardware.example.com',
  email: 'sponsor@riverside-hardware.example.com',
  phone: '+27 21 555 0177',
  logoUrl: '/media/managed/sponsor-logo.png',
  bannerUrl: '/media/managed/sponsor-banner.png',
  socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-hardware' }],
}

describe('SponsorForm', () => {
  it('renders all three tabs, none disabled, and all reachable, when created fresh (no initialValues)', async () => {
    const user = userEvent.setup()
    renderSponsorForm({ onSubmit: vi.fn() })

    expect(screen.getByRole('tab', { name: 'Basic Info' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Branding' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Social Media' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Basic Info' })).not.toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Branding' })).not.toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Social Media' })).not.toBeDisabled()

    // Basic Info is the default tab.
    expect(screen.getByLabelText('Name')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Branding' }))
    expect(screen.getByText('Logo')).toBeInTheDocument()
    expect(screen.getByText('Banner')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()
  })

  it('renders all three tabs, none disabled, and all reachable, when populated (edit-mode initialValues) — no create-vs-edit distinction in tab availability, unlike ClubForm', async () => {
    const user = userEvent.setup()
    renderSponsorForm({ onSubmit: vi.fn(), initialValues: populatedValues })

    expect(screen.getByRole('tab', { name: 'Basic Info' })).not.toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Branding' })).not.toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Social Media' })).not.toBeDisabled()

    expect(screen.getByLabelText('Name')).toHaveValue('Riverside Hardware')

    await user.click(screen.getByRole('tab', { name: 'Branding' }))
    expect(screen.getAllByRole('button', { name: 'Replace' })).toHaveLength(2)

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByDisplayValue('https://facebook.com/riverside-hardware')).toBeInTheDocument()
  })

  it('blocks submit on a blank Name, shows an inline error, and switches to the Basic Info tab if not already there', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorForm({ onSubmit })

    // Navigate away from Basic Info first, so the tab-switch-on-error behaviour is actually
    // exercised rather than a no-op.
    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByRole('tab', { name: 'Social Media' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Basic Info' })).toHaveAttribute('aria-selected', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders a validation error for a malformed website submitted before the field is blurred (so WebsiteInput has not yet normalized it)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Riverside Hardware')
    await user.type(screen.getByLabelText('Website'), 'not a url')
    // Submitted via the form directly (not a button click, which would blur Website first and
    // let WebsiteInput normalize it to "https://not a url" before validate() ever runs) —
    // mirrors ClubForm.test.tsx's identical case for the same WebsiteInput behaviour.
    fireEvent.submit(screen.getByLabelText('Website').closest('form') as HTMLFormElement)

    expect(await screen.findByText('Enter a valid website URL, e.g. https://example.com')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validates a malformed Email only when non-blank, and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Riverside Hardware')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    // Clearing back to blank drops the format error entirely — it only fires when non-blank,
    // matching Phone (never validated) and unlike Name (always required).
    await user.clear(screen.getByLabelText('Email'))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('normalizes a scheme-less website to https:// on blur (WebsiteInput)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Riverside Hardware')
    await user.type(screen.getByLabelText('Website'), 'www.riverside-hardware.example.com')
    await user.click(screen.getByLabelText('Email'))

    expect(screen.getByLabelText('Website')).toHaveValue('https://www.riverside-hardware.example.com')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as SponsorPayload
    expect(payload.website).toBe('https://www.riverside-hardware.example.com')
  })

  it('submits a correctly-shaped SponsorPayload, normalizing blank optional fields to null (not empty strings)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Riverside Hardware')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as SponsorPayload
    expect(payload).toEqual({
      name: 'Riverside Hardware',
      website: null,
      email: null,
      phone: null,
      logoUrl: null,
      bannerUrl: null,
      socialLinks: [],
    })
  })

  it('uploads a logo and a banner via the manage-namespace endpoint and includes both resulting URLs in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/sponsor-logo.png' })
    uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/sponsor-banner.png' })
    renderSponsorForm({ onSubmit })

    await user.click(screen.getByRole('tab', { name: 'Branding' }))

    const logoFile = new File(['logo'], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Logo file'), logoFile)
    await screen.findByRole('button', { name: 'Replace' })

    const bannerFile = new File(['banner'], 'banner.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Banner file'), bannerFile)
    await screen.findAllByRole('button', { name: 'Replace' })

    // SponsorForm passes namespace="manage" to both MediaUpload instances — the manage-scoped
    // upload function is called, never the platform one a CLUB_ADMIN can't reach.
    expect(uploadManagedMedia).toHaveBeenCalledWith(logoFile)
    expect(uploadManagedMedia).toHaveBeenCalledWith(bannerFile)
    expect(uploadMedia).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: 'Basic Info' }))
    await user.type(screen.getByLabelText('Name'), 'Riverside Hardware')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as SponsorPayload
    expect(payload.logoUrl).toBe('/media/managed/sponsor-logo.png')
    expect(payload.bannerUrl).toBe('/media/managed/sponsor-banner.png')
  })

  it('wires the Social Media tab to SocialLinksFields, including an added link in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSponsorForm({ onSubmit })

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add link' }))
    await user.type(screen.getByLabelText('URL'), 'https://facebook.com/riverside-hardware')

    await user.click(screen.getByRole('tab', { name: 'Basic Info' }))
    await user.type(screen.getByLabelText('Name'), 'Riverside Hardware')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as SponsorPayload
    expect(payload.socialLinks).toEqual([{ platform: 'facebook', url: 'https://facebook.com/riverside-hardware' }])
  })
})
