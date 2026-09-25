import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LeagueForm, LEAGUE_FORM_ID } from './LeagueForm'
import type { LeagueFormProps } from './LeagueForm'
import type { LeaguePayload } from '../../api/leagueApi'

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

describe('LeagueForm', () => {
  it('defaults playing XI size to 11', () => {
    renderLeagueForm({ onSubmit: vi.fn() })
    expect(screen.getByLabelText('Playing XI size')).toHaveValue(11)
  })

  it('does not render a League.source picker', () => {
    renderLeagueForm({ onSubmit: vi.fn() })
    expect(screen.queryByLabelText(/source/i)).not.toBeInTheDocument()
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
    await user.type(screen.getByLabelText('Min age'), '50')
    await user.type(screen.getByLabelText('Max age'), '40')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Min age must be less than or equal to max age')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a full payload, defaulting unset age fields to null', async () => {
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
    })
  })

  it('submits min/max age and cutoff date when provided', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderLeagueForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), 'U15 League')
    await user.clear(screen.getByLabelText('Playing XI size'))
    await user.type(screen.getByLabelText('Playing XI size'), '11')
    await user.type(screen.getByLabelText('Min age'), '13')
    await user.type(screen.getByLabelText('Max age'), '15')
    await user.type(screen.getByLabelText('Age cutoff date'), '2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    const payload = onSubmit.mock.calls[0][0] as LeaguePayload
    expect(payload).toEqual({
      name: 'U15 League',
      maxPlayingXiSize: 11,
      minAge: 13,
      maxAge: 15,
      ageCutoffDate: '2026-12-31',
    })
  })

  it('prefills from initialValues', () => {
    renderLeagueForm({
      onSubmit: vi.fn(),
      initialValues: { name: 'Existing League', maxPlayingXiSize: 12 },
    })

    expect(screen.getByLabelText('Name')).toHaveValue('Existing League')
    expect(screen.getByLabelText('Playing XI size')).toHaveValue(12)
  })
})
