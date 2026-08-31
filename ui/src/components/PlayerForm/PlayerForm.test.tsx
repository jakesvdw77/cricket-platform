import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PlayerForm, PLAYER_FORM_ID } from './PlayerForm'
import type { PlayerFormProps, PlayerFormValues } from './PlayerForm'

const uploadMedia = vi.fn()
const uploadManagedMedia = vi.fn()

// PlayerForm's Basic Info tab renders the real MediaUpload component (namespace="manage") for
// Photo — mocking mediaApi's two exports here (same shape as SponsorForm.test.tsx) proves the
// namespace wiring for real, rather than mocking MediaUpload itself.
vi.mock('../../api/mediaApi', () => ({
  uploadMedia: (file: File) => uploadMedia(file),
  uploadManagedMedia: (file: File) => uploadManagedMedia(file),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// PlayerForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// PlayerFormPage) and targets the form via the native `form="…"` attribute — this mirrors that
// wiring so submit behaviour can be exercised in isolation, same pattern as
// SponsorForm.test.tsx/TeamForm.test.tsx.
function renderPlayerForm(props: PlayerFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <PlayerForm {...props} />
      <button type="submit" form={PLAYER_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

const populatedValues: Partial<PlayerFormValues> = {
  firstName: 'Sipho',
  lastName: 'Ndlovu',
  dateOfBirth: '2010-04-12',
  gender: 'MALE',
  photoUrl: '/media/managed/player-photo.png',
  clubMembershipNumber: 'RCC-042',
  medicalAidProvider: 'Discovery',
  medicalAidMemberNumber: 'DH-99123',
  phone: '+27 21 555 0188',
  email: 'sipho.ndlovu@example.com',
  altContactName: 'Nomvula Ndlovu',
  altContactPhone: '+27 21 555 0199',
  battingStance: 'RIGHT_HANDED',
  bowlingArm: 'RIGHT_ARM',
  bowlingType: 'OFF_BREAK',
  isWicketKeeper: true,
}

describe('PlayerForm', () => {
  it('renders the Basic Info panel fields when activeTab is 0, and no other tabs\' fields', () => {
    renderPlayerForm({ activeTab: 0, onSubmit: vi.fn() })

    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last name')).toBeInTheDocument()
    expect(screen.getByLabelText('Date of birth')).toBeInTheDocument()
    expect(screen.getByLabelText('Gender')).toBeInTheDocument()
    expect(screen.getByText('Photo')).toBeInTheDocument()
    expect(screen.getByLabelText('Club membership number')).toBeInTheDocument()
    expect(screen.getByLabelText('Medical aid provider')).toBeInTheDocument()
    expect(screen.getByLabelText('Medical aid member number')).toBeInTheDocument()

    expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Batting stance')).not.toBeInTheDocument()
  })

  it('renders the Contact Info panel fields when activeTab is 1, and no other tabs\' fields', () => {
    renderPlayerForm({ activeTab: 1, onSubmit: vi.fn() })

    expect(screen.getByLabelText('Phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Alternative contact name')).toBeInTheDocument()
    expect(screen.getByLabelText('Alternative contact phone')).toBeInTheDocument()

    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Batting stance')).not.toBeInTheDocument()
  })

  it('renders the Cricket Info panel fields when activeTab is 2, and no other tabs\' fields', () => {
    renderPlayerForm({ activeTab: 2, onSubmit: vi.fn() })

    expect(screen.getByLabelText('Batting stance')).toBeInTheDocument()
    expect(screen.getByLabelText('Bowling arm')).toBeInTheDocument()
    expect(screen.getByLabelText('Bowling type')).toBeInTheDocument()
    expect(screen.getByLabelText('Wicketkeeper')).toBeInTheDocument()

    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument()
  })

  it('prefills every field from initialValues, regardless of which tab is active', () => {
    renderPlayerForm({ activeTab: 0, onSubmit: vi.fn(), initialValues: populatedValues })
    expect(screen.getByLabelText('First name')).toHaveValue('Sipho')
    expect(screen.getByLabelText('Last name')).toHaveValue('Ndlovu')
    expect(screen.getByLabelText('Date of birth')).toHaveValue('2010-04-12')
    // MUI's Select renders a role="combobox" div (not a native <select>/<input>) for its visible
    // control — its rendered text is the chosen MenuItem's label ("Male"), not the raw enum value
    // toHaveValue() would check on a native form element.
    expect(screen.getByLabelText('Gender')).toHaveTextContent('Male')
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
  })

  it('blocks submit when First name/Last name are blank, and does not call onSubmit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderPlayerForm({ activeTab: 0, onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a correctly-shaped PlayerPayload, normalizing blank optional fields to null (not empty strings)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderPlayerForm({ activeTab: 0, onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Sipho')
    await user.type(screen.getByLabelText('Last name'), 'Ndlovu')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as PlayerFormValues
    expect(payload).toEqual({
      firstName: 'Sipho',
      lastName: 'Ndlovu',
      dateOfBirth: null,
      gender: null,
      photoUrl: null,
      clubMembershipNumber: null,
      medicalAidProvider: null,
      medicalAidMemberNumber: null,
      phone: null,
      email: null,
      altContactName: null,
      altContactPhone: null,
      battingStance: null,
      bowlingArm: null,
      bowlingType: null,
      isWicketKeeper: false,
    })
  })

  it('submits every populated field (Gender/Batting stance/Bowling arm/Bowling type/Wicketkeeper included) with the exact enum values selected', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { rerender } = renderPlayerForm({ activeTab: 0, onSubmit })

    await user.type(screen.getByLabelText('First name'), 'Sipho')
    await user.type(screen.getByLabelText('Last name'), 'Ndlovu')

    await user.click(screen.getByLabelText('Gender'))
    await user.click(await screen.findByRole('option', { name: 'Male' }))

    rerender(
      <>
        <PlayerForm activeTab={2} onSubmit={onSubmit} />
        <button type="submit" form={PLAYER_FORM_ID}>
          Submit
        </button>
      </>,
    )

    await user.click(screen.getByLabelText('Batting stance'))
    await user.click(await screen.findByRole('option', { name: 'Right-handed' }))

    await user.click(screen.getByLabelText('Bowling arm'))
    await user.click(await screen.findByRole('option', { name: 'Right-arm' }))

    await user.click(screen.getByLabelText('Bowling type'))
    await user.click(await screen.findByRole('option', { name: 'Off break' }))

    await user.click(screen.getByLabelText('Wicketkeeper'))

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as PlayerFormValues
    expect(payload.gender).toBe('MALE')
    expect(payload.battingStance).toBe('RIGHT_HANDED')
    expect(payload.bowlingArm).toBe('RIGHT_ARM')
    expect(payload.bowlingType).toBe('OFF_BREAK')
    expect(payload.isWicketKeeper).toBe(true)
  })

  it('uploads a photo via the manage-namespace endpoint and includes the resulting URL in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    uploadManagedMedia.mockResolvedValueOnce({ url: '/media/managed/player-photo.png' })
    renderPlayerForm({ activeTab: 0, onSubmit })

    const photoFile = new File(['photo'], 'photo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Photo file'), photoFile)
    await screen.findByRole('button', { name: 'Replace' })

    expect(uploadManagedMedia).toHaveBeenCalledWith(photoFile)
    expect(uploadMedia).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('First name'), 'Sipho')
    await user.type(screen.getByLabelText('Last name'), 'Ndlovu')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as PlayerFormValues
    expect(payload.photoUrl).toBe('/media/managed/player-photo.png')
  })
})
