import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SeasonForm, SEASON_FORM_ID } from './SeasonForm'
import type { SeasonFormProps } from './SeasonForm'
import type { SeasonPayload } from '../../api/seasonApi'

function renderSeasonForm(props: SeasonFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <SeasonForm {...props} />
      <button type="submit" form={SEASON_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

describe('SeasonForm', () => {
  it('renders inline validation errors for blank required fields and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSeasonForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Label is required')).toBeInTheDocument()
    expect(screen.getByText('Start date is required')).toBeInTheDocument()
    expect(screen.getByText('End date is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a start date after the end date, mirroring the server rule', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSeasonForm({ onSubmit })

    await user.type(screen.getByLabelText('Label'), '2026')
    await user.type(screen.getByLabelText('Start date'), '2026-12-31')
    await user.type(screen.getByLabelText('End date'), '2026-01-01')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Start date must be on or before end date')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits {label, startDate, endDate} on a valid range', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderSeasonForm({ onSubmit })

    await user.type(screen.getByLabelText('Label'), '2026')
    await user.type(screen.getByLabelText('Start date'), '2026-01-01')
    await user.type(screen.getByLabelText('End date'), '2026-12-31')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as SeasonPayload
    expect(payload).toEqual({ label: '2026', startDate: '2026-01-01', endDate: '2026-12-31' })
  })

  it('prefills from initialValues', () => {
    renderSeasonForm({
      onSubmit: vi.fn(),
      initialValues: { label: '2025', startDate: '2025-01-01', endDate: '2025-12-31' },
    })

    expect(screen.getByLabelText('Label')).toHaveValue('2025')
    expect(screen.getByLabelText('Start date')).toHaveValue('2025-01-01')
    expect(screen.getByLabelText('End date')).toHaveValue('2025-12-31')
  })
})
