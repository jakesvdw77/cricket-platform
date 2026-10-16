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
  ageCutoffMonth: 12,
  ageCutoffDay: 31,
  format: 'T20',
  phone: '+27 21 555 0177',
  website: 'https://riverside.example.com',
  email: 'league@riverside.example.com',
  logoUrl: '/media/managed/league-logo.png',
  socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-league' }],
}

// MUI selects open a listbox: choose an option by its visible name.
async function chooseOption(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(screen.getByLabelText(field))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function chooseCutoff(user: ReturnType<typeof userEvent.setup>, month: string, day: string) {
  await chooseOption(user, 'Cut-off month (optional)', month)
  await chooseOption(user, 'Cut-off day (optional)', day)
}

// An empty MUI select shows only a zero-width space.
const EMPTY = /^\u200b?$/
const CUTOFF_MONTH = 'Cut-off month (optional)'
const CUTOFF_DAY = 'Cut-off day (optional)'

describe('LeagueForm', () => {
  // docs/specs/091 (D): the inner Basic Info / Branding / Social Media tabs are three sections of one form.
  it('renders Basic info, Contact and Branding and social as sections of one form, with no tabs', () => {
    renderLeagueForm({ onSubmit: vi.fn() })

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    for (const name of ['Basic info', 'Contact', 'Branding and social']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Playing XI size')).toHaveValue(11)
    expect(screen.getByText('Logo')).toBeInTheDocument()
    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()
  })

  it('puts "(optional)" in the labels of the optional fields and shows no helper text', () => {
    renderLeagueForm({ onSubmit: vi.fn() })

    for (const label of ['Min age (optional)', 'Max age (optional)', 'Cut-off month (optional)', 'Cut-off day (optional)', 'Phone (optional)', 'Website (optional)', 'Email (optional)']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText(/Leave blank|Defaults to 11|Purely descriptive|e\.g\./)).not.toBeInTheDocument()
  })

  it('does not render a League.source picker', () => {
    renderLeagueForm({ onSubmit: vi.fn() })
    expect(screen.queryByLabelText(/^source$/i)).not.toBeInTheDocument()
  })

  it('prefills every section from initialValues, including the profile fields', () => {
    renderLeagueForm({ onSubmit: vi.fn(), initialValues: populatedValues })

    expect(screen.getByLabelText('Name')).toHaveValue('Existing League')
    expect(screen.getByLabelText('Playing XI size')).toHaveValue(12)
    expect(screen.getByLabelText('Format')).toHaveTextContent('T20')
    expect(screen.getByLabelText('Phone (optional)')).toHaveValue('+27 21 555 0177')
    expect(screen.getByLabelText('Website (optional)')).toHaveValue('https://riverside.example.com')
    expect(screen.getByLabelText('Email (optional)')).toHaveValue('league@riverside.example.com')
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://facebook.com/riverside-league')).toBeInTheDocument()
  })

  it('renders an inline validation error for a blank name and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects minAge > maxAge client-side, mirroring the server rule', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.type(screen.getByLabelText('Min age (optional)'), '50')
    await user.type(screen.getByLabelText('Max age (optional)'), '40')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Min age must be less than or equal to max age')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders a validation error for a malformed website submitted before the field is blurred (so WebsiteInput has not yet normalized it)', async () => {
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Vets League' } })
    fireEvent.change(screen.getByLabelText('Website (optional)'), { target: { value: 'not a url' } })
    fireEvent.submit(screen.getByLabelText('Website (optional)').closest('form') as HTMLFormElement)

    expect(await screen.findByText('Enter a valid website URL, e.g. https://example.com')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('validates a malformed Email only when non-blank, and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.type(screen.getByLabelText('Email (optional)'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Email (optional)'))
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
      ageCutoffMonth: 12,
      ageCutoffDay: 31,
      format: null,
      phone: null,
      website: null,
      email: null,
      logoUrl: null,
      socialLinks: [],
    })
  })

  it('submits min/max age, cut-off day and month, and format when provided', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'U15 League')
    await user.clear(screen.getByLabelText('Playing XI size'))
    await user.type(screen.getByLabelText('Playing XI size'), '11')
    await user.type(screen.getByLabelText('Min age (optional)'), '13')
    await user.type(screen.getByLabelText('Max age (optional)'), '15')
    await chooseCutoff(user, 'September', '1')
    await user.click(screen.getByLabelText('Format'))
    await user.click(await screen.findByRole('option', { name: '1 Day' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload).toEqual({
      name: 'U15 League',
      maxPlayingXiSize: 11,
      minAge: 13,
      maxAge: 15,
      ageCutoffMonth: 9,
      ageCutoffDay: 1,
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

    const logoFile = new File(['logo'], 'logo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Logo file'), logoFile)
    await screen.findByRole('button', { name: 'Replace' })

    // LeagueForm passes namespace="manage" to MediaUpload — the manage-scoped upload function is
    // called, never the platform one a CLUB_ADMIN can't reach.
    expect(uploadManagedMedia).toHaveBeenCalledWith(logoFile)
    expect(uploadMedia).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload.logoUrl).toBe('/media/managed/league-logo.png')
  })

  it('wires the social links section to SocialLinksFields, including an added link in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    expect(screen.getByText('No social links added yet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add link' }))
    await user.type(screen.getByLabelText('URL'), 'https://facebook.com/riverside-league')

    await user.type(screen.getByLabelText('Name'), 'Vets League')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload.socialLinks).toEqual([{ platform: 'facebook', url: 'https://facebook.com/riverside-league' }])
  })

  // docs/specs/110: the cut-off is a day and month, filled with 31 December when an age limit is first entered.
  describe('age cut-off (docs/specs/110)', () => {
    const HELPER =
      'Ages are judged on this day in the year the league starts. Leave empty to judge ages on the day the league starts (for example a winter league).'

    it('shows the helper text and opens the Add form with 31 December', () => {
      renderLeagueForm({ onSubmit: vi.fn() })
      expect(screen.getByText(HELPER)).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Age cut-off (day and month)' })).toBeInTheDocument()
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent('December')
      expect(screen.getByLabelText(CUTOFF_DAY)).toHaveTextContent('31')
    })

    it('lets the manager change the default, and keeps it when an age limit is entered', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn() })
      await chooseCutoff(user, 'June', '30')
      await user.type(screen.getByLabelText('Max age (optional)'), '15')
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent('June')
      expect(screen.getByLabelText(CUTOFF_DAY)).toHaveTextContent('30')
    })

    it('does not re-fill once the manager has cleared the cut-off to Not set', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn() })
      await chooseOption(user, CUTOFF_MONTH, 'Not set')
      await chooseOption(user, CUTOFF_DAY, 'Not set')
      await user.type(screen.getByLabelText('Max age (optional)'), '15')
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent(EMPTY)
      expect(screen.getByLabelText(CUTOFF_DAY)).toHaveTextContent(EMPTY)
    })

    it('keeps a loaded cut-off when an age limit changes', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn(), initialValues: { ...populatedValues, ageCutoffMonth: 6, ageCutoffDay: 30 } })
      await user.clear(screen.getByLabelText('Max age (optional)'))
      await user.type(screen.getByLabelText('Max age (optional)'), '16')
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent('June')
      expect(screen.getByLabelText(CUTOFF_DAY)).toHaveTextContent('30')
    })

    it('leaves an edited league with no cut-off empty, even with limits and when a limit changes', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn(), initialValues: { name: 'Winter', minAge: 12, maxAge: 14 } })
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent(EMPTY)
      await user.type(screen.getByLabelText('Max age (optional)'), '5')
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent(EMPTY)
    })

    it('leaves an edited league with no limits and no cut-off empty', () => {
      renderLeagueForm({ onSubmit: vi.fn(), initialValues: { name: 'Open' } })
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent(EMPTY)
      expect(screen.getByLabelText(CUTOFF_DAY)).toHaveTextContent(EMPTY)
    })

    it('fills 31 December on edit when the first age limit is entered into an empty, untouched cut-off', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn(), initialValues: { name: 'Open' } })
      await user.type(screen.getByLabelText('Max age (optional)'), '1')
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent('December')
      expect(screen.getByLabelText(CUTOFF_DAY)).toHaveTextContent('31')
    })

    it('does not fill on edit when the manager cleared the cut-off first', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn(), initialValues: { name: 'Open', ageCutoffMonth: 6, ageCutoffDay: 30 } })
      await chooseOption(user, CUTOFF_MONTH, 'Not set')
      await chooseOption(user, CUTOFF_DAY, 'Not set')
      await user.type(screen.getByLabelText('Max age (optional)'), '1')
      expect(screen.getByLabelText(CUTOFF_MONTH)).toHaveTextContent(EMPTY)
    })

    it('hides the no-effect note on the untouched Add default, and while an age limit is set', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn() })
      expect(screen.queryByTestId('cutoff-no-effect')).not.toBeInTheDocument()
      await user.type(screen.getByLabelText('Max age (optional)'), '15')
      expect(screen.queryByTestId('cutoff-no-effect')).not.toBeInTheDocument()
    })

    it('shows the no-effect note once the manager chooses a cut-off with no age limit', async () => {
      const user = userEvent.setup()
      renderLeagueForm({ onSubmit: vi.fn() })
      await chooseCutoff(user, 'June', '30')
      expect(screen.getByTestId('cutoff-no-effect')).toHaveTextContent('This cut-off has no effect until an age limit is set.')
    })

    it('shows the no-effect note for a stored cut-off on edit with no age limit', () => {
      renderLeagueForm({ onSubmit: vi.fn(), initialValues: { name: 'Open', ageCutoffMonth: 12, ageCutoffDay: 31 } })
      expect(screen.getByTestId('cutoff-no-effect')).toBeInTheDocument()
    })

    it('refuses a month without a day, and a day without a month', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderLeagueForm({ onSubmit })
      await user.type(screen.getByLabelText('Name'), 'L')
      await chooseOption(user, CUTOFF_DAY, 'Not set')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByText('Choose the day as well as the month')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()

      await chooseOption(user, CUTOFF_MONTH, 'Not set')
      await chooseOption(user, CUTOFF_DAY, '5')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByText('Choose the month as well as the day')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('refuses 31 April and 30 February', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderLeagueForm({ onSubmit })
      await user.type(screen.getByLabelText('Name'), 'L')
      await chooseCutoff(user, 'April', '31')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByText('April has no day 31. Choose a day from 1 to 30.')).toBeInTheDocument()

      await chooseOption(user, CUTOFF_MONTH, 'February')
      await chooseOption(user, CUTOFF_DAY, '30')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByText('February has no day 30. Choose a day from 1 to 29.')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('accepts 29 February and sends the month and day as numbers', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderLeagueForm({ onSubmit })
      await user.type(screen.getByLabelText('Name'), 'L')
      await chooseCutoff(user, 'February', '29')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      const payload = onSubmit.mock.calls[0][0] as LeaguePayload
      expect(payload.ageCutoffMonth).toBe(2)
      expect(payload.ageCutoffDay).toBe(29)
    })

    it('sends 31 December from an untouched Add form, and null for both when cleared', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderLeagueForm({ onSubmit })
      await user.type(screen.getByLabelText('Name'), 'L')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ ageCutoffMonth: 12, ageCutoffDay: 31, minAge: null, maxAge: null })

      await chooseOption(user, CUTOFF_MONTH, 'Not set')
      await chooseOption(user, CUTOFF_DAY, 'Not set')
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(onSubmit.mock.calls[1][0]).toMatchObject({ ageCutoffMonth: null, ageCutoffDay: null })
    })
  })
})
