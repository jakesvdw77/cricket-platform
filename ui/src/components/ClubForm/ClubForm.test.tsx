import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ClubForm, CLUB_FORM_ID } from './ClubForm'
import type { ClubFormProps } from './ClubForm'
import type { ClubPayload, ClubProfilePayload } from '../../api/clubApi'

const uploadMedia = vi.fn()
const uploadManagedMedia = vi.fn()

vi.mock('../../api/mediaApi', () => ({
  uploadMedia: (file: File) => uploadMedia(file),
  uploadManagedMedia: (file: File) => uploadManagedMedia(file),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

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

const filledProfile: ClubProfilePayload = {
  type: 'CLUB',
  logoUrl: '/media/logo.png',
  bannerUrl: '/media/banner.png',
  address: {
    number: '12',
    street: 'Main Road',
    city: 'Cape Town',
    provinceState: 'Western Cape',
    country: 'South Africa',
    postalCode: '8001',
  },
  email: 'club@riverside.example.com',
  phone: '+27 21 555 0100',
  website: 'https://riverside-cc.example.com',
}

describe('ClubForm', () => {
  it('renders the name and slug fields, on the default Basic Info tab', () => {
    renderClubForm({ onSubmit: vi.fn() })

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toBeInTheDocument()
  })

  it('renders all five tabs', () => {
    renderClubForm({ onSubmit: vi.fn() })

    expect(screen.getByRole('tab', { name: 'Basic Info' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Address' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Branding' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Social Media' })).toBeInTheDocument()
  })

  it('disables the Contact, Address, and Branding tabs, and the Type field, when profileInitialValues is undefined (create mode)', () => {
    renderClubForm({ onSubmit: vi.fn() })

    expect(screen.getByRole('tab', { name: 'Contact' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Address' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Branding' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Basic Info' })).not.toBeDisabled()

    // MUI's select renders a div[role="combobox"], not a native disableable form control —
    // aria-disabled is the correct assertion here, matching ProductForm.test.tsx's own
    // precedent for its Billing interval select.
    expect(screen.getByLabelText('Type')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Save the club first to set this.')).toBeInTheDocument()
  })

  it('enables the Contact, Address, and Branding tabs, and the Type field, once profileInitialValues is provided (edit mode)', async () => {
    const user = userEvent.setup()
    renderClubForm({
      onSubmit: vi.fn(),
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    expect(screen.getByRole('tab', { name: 'Contact' })).not.toBeDisabled()
    expect(screen.getByLabelText('Type')).not.toBeDisabled()

    await user.click(screen.getByRole('tab', { name: 'Contact' }))
    expect(screen.getByLabelText('Email')).toHaveValue('club@riverside.example.com')
    expect(screen.getByLabelText('Phone')).toHaveValue('+27 21 555 0100')
    expect(screen.getByLabelText('Website')).toHaveValue('https://riverside-cc.example.com')

    await user.click(screen.getByRole('tab', { name: 'Address' }))
    expect(screen.getByLabelText('Street')).toHaveValue('Main Road')

    await user.click(screen.getByRole('tab', { name: 'Branding' }))
    // Both Logo and Banner already have a value in filledProfile, so each renders its own
    // "Replace" button.
    expect(screen.getAllByRole('button', { name: 'Replace' })).toHaveLength(2)
  })

  // Regression coverage: in default ('full') mode, the Branding tab's uploads must go through
  // the platform-namespace endpoint (its only real caller, ClubFormPage, is a platform_admin
  // screen) — not the manage one, which a platform_admin's own token may not even carry the
  // right club context for.
  it('uploads Branding tab images via the platform-namespace endpoint in default (\'full\') mode', async () => {
    const user = userEvent.setup()
    uploadMedia.mockResolvedValueOnce({ url: '/media/new-logo.png' })
    renderClubForm({
      onSubmit: vi.fn(),
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    await user.click(screen.getByRole('tab', { name: 'Branding' }))
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Logo file'), file)

    await waitFor(() => expect(uploadMedia).toHaveBeenCalledWith(file))
    expect(uploadManagedMedia).not.toHaveBeenCalled()
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

  it('submits a { club } payload, with no profile key, in create mode', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Riverside CC')
    await user.clear(screen.getByLabelText('Slug'))
    await user.type(screen.getByLabelText('Slug'), 'riverside-cc')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as { club: ClubPayload; profile?: ClubProfilePayload }
    expect(payload).toEqual({ club: { name: 'Riverside CC', slug: 'riverside-cc' } })
  })

  it('submits a { club, profile } payload in edit mode, with an untouched email/phone/website normalized to null', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({
      onSubmit,
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: {
        type: null,
        logoUrl: null,
        bannerUrl: null,
        address: { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null },
        email: null,
        phone: null,
        website: null,
      },
    })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as { club: ClubPayload; profile?: ClubProfilePayload }
    expect(payload.club).toEqual({ name: 'Riverside Cricket Club', slug: 'riverside-cc' })
    expect(payload.profile).toEqual({
      type: null,
      logoUrl: null,
      bannerUrl: null,
      address: { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null },
      email: null,
      phone: null,
      website: null,
    })
  })

  it('renders a validation error for a malformed email, and switches to the Contact tab to surface it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({
      onSubmit,
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    await user.click(screen.getByRole('tab', { name: 'Contact' }))
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('tab', { name: 'Basic Info' }))

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Contact' })).toHaveAttribute('aria-selected', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders a validation error for a malformed website submitted before the field is blurred (so WebsiteInput has not yet normalized it)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({
      onSubmit,
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    await user.click(screen.getByRole('tab', { name: 'Contact' }))
    await user.clear(screen.getByLabelText('Website'))
    await user.type(screen.getByLabelText('Website'), 'not a url')
    // Submitted via the form directly (not a button click, which would blur Website first and
    // let its own https:// normalization run) — exercises validate()'s own check independently.
    fireEvent.submit(screen.getByLabelText('Website').closest('form') as HTMLFormElement)

    expect(
      await screen.findByText('Enter a valid website URL, e.g. https://example.com'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('lets the admin pick an organisation type once the Type field is enabled', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({
      onSubmit,
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    const typeField = screen.getByLabelText('Type')
    await user.click(typeField)
    await user.click(await screen.findByRole('option', { name: 'Academy' }))

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as { club: ClubPayload; profile?: ClubProfilePayload }
    expect(payload.profile?.type).toBe('ACADEMY')
  })

  it('renders a fifth "Social Media" tab, reachable in create mode (disabled, same as the other profile tabs)', () => {
    renderClubForm({ onSubmit: vi.fn() })

    expect(screen.getByRole('tab', { name: 'Social Media' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Social Media' })).toBeDisabled()
  })

  it('renders a reachable "Social Media" tab holding SocialLinksFields, once profileInitialValues is provided (edit mode)', async () => {
    const user = userEvent.setup()
    renderClubForm({
      onSubmit: vi.fn(),
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    expect(screen.getByRole('tab', { name: 'Social Media' })).not.toBeDisabled()

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))

    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()
  })

  it('submitting with at least one social link includes socialLinks in the submitted profile payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({
      onSubmit,
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    await user.click(screen.getByRole('tab', { name: 'Social Media' }))
    await user.click(screen.getByRole('button', { name: 'Add link' }))
    await user.type(screen.getByLabelText('URL'), 'https://facebook.com/cricketlegend')

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as { club: ClubPayload; profile?: ClubProfilePayload }
    expect(payload.profile?.socialLinks).toEqual([{ platform: 'facebook', url: 'https://facebook.com/cricketlegend' }])
  })

  it('submitting with zero social links omits the socialLinks key entirely from the payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClubForm({
      onSubmit,
      initialValues: { name: 'Riverside Cricket Club', slug: 'riverside-cc' },
      profileInitialValues: filledProfile,
    })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as { club: ClubPayload; profile?: ClubProfilePayload }
    expect(payload.profile).toBeDefined()
    expect('socialLinks' in (payload.profile as object)).toBe(false)
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

  describe('mode="profileOnly" (docs/specs/020-club-manager-access.md)', () => {
    it('renders no Basic Info tab, and the Contact/Address/Branding tabs are enabled, not gated behind "Save the club first"', () => {
      renderClubForm({ onSubmit: vi.fn(), mode: 'profileOnly', profileInitialValues: filledProfile })

      expect(screen.queryByRole('tab', { name: 'Basic Info' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument()

      expect(screen.getByRole('tab', { name: 'Contact' })).not.toBeDisabled()
      expect(screen.getByRole('tab', { name: 'Address' })).not.toBeDisabled()
      expect(screen.getByRole('tab', { name: 'Branding' })).not.toBeDisabled()
      expect(screen.getByRole('tab', { name: 'Social Media' })).not.toBeDisabled()
      expect(screen.queryByText('Save the club first')).not.toBeInTheDocument()
    })

    it('the Social Media tab is present and reachable', async () => {
      const user = userEvent.setup()
      renderClubForm({ onSubmit: vi.fn(), mode: 'profileOnly', profileInitialValues: filledProfile })

      await user.click(screen.getByRole('tab', { name: 'Social Media' }))

      expect(screen.getByText('No social links added yet.')).toBeInTheDocument()
    })

    it('renders the org-type select inside the Contact tab, since there is no Basic Info tab to host it', () => {
      renderClubForm({ onSubmit: vi.fn(), mode: 'profileOnly', profileInitialValues: filledProfile })

      // Contact is tab index 0 in this mode, so it's already active by default — the Type
      // field should be reachable without switching tabs.
      expect(screen.getByRole('tab', { name: 'Contact' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Type')).toBeInTheDocument()
      expect(screen.getByLabelText('Type')).not.toBeDisabled()
    })

    // Regression coverage for a real bug: ManageClubProfilePage renders ClubForm with
    // mode="profileOnly" for a CLUB_ADMIN, who can never reach POST /api/v1/platform/media
    // (platform_admin-only at the URL gate) — before this fix, both MediaUpload calls in the
    // Branding tab defaulted to namespace="platform" regardless of mode, so every real club
    // admin's logo/banner upload 403'd, surfaced only as MediaUpload's generic "Something went
    // wrong uploading" message.
    it('uploads Branding tab images via the manage-namespace endpoint, not the platform one', async () => {
      const user = userEvent.setup()
      uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/new-logo.png' })
      renderClubForm({ onSubmit: vi.fn(), mode: 'profileOnly', profileInitialValues: filledProfile })

      await user.click(screen.getByRole('tab', { name: 'Branding' }))
      const file = new File(['logo'], 'logo.png', { type: 'image/png' })
      await user.upload(screen.getByLabelText('Logo file'), file)

      await waitFor(() => expect(uploadManagedMedia).toHaveBeenCalledWith(file))
      expect(uploadMedia).not.toHaveBeenCalled()
    })

    it('submits { profile } only, with no club key at all, and does not validate name/slug', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderClubForm({ onSubmit, mode: 'profileOnly', profileInitialValues: filledProfile })

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      const values = onSubmit.mock.calls[0][0] as { club?: ClubPayload; profile?: ClubProfilePayload }
      expect(values.club).toBeUndefined()
      expect('club' in values).toBe(false)
      expect(values.profile).toEqual(filledProfile)
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
    })
  })
})
