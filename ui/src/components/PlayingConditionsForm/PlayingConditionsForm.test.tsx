import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayingConditionsForm } from './PlayingConditionsForm'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'

const savedValues: PlayingConditionsPayload = {
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: 4,
  fieldingRestrictionsNotes: 'Two fielders outside the circle in the powerplay.',
  pointsForWin: 4,
  pointsForLoss: 0,
  pointsForDraw: 2,
  pointsForNoResult: 2,
  pointsForForfeitWin: 4,
  bonusPointsEnabled: true,
  bonusBattingOversThreshold: 17,
  bonusBowlingRestrictionPercentage: 80,
  additionalNotes: 'DLS applies for rain-affected matches.',
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText('Max overs per innings'))
  await user.type(screen.getByLabelText('Max overs per innings'), '20')
  await user.clear(screen.getByLabelText('Powerplay overs'))
  await user.type(screen.getByLabelText('Powerplay overs'), '6')
}

describe('PlayingConditionsForm', () => {
  it('seeds the standard T20 point defaults when no initialValues are provided', () => {
    render(<PlayingConditionsForm onSubmit={vi.fn()} pending={false} />)

    expect(screen.getByLabelText('Points for win')).toHaveValue(2)
    expect(screen.getByLabelText('Points for loss')).toHaveValue(0)
    expect(screen.getByLabelText('Points for draw')).toHaveValue(1)
    expect(screen.getByLabelText('Points for no result')).toHaveValue(1)
    expect(screen.getByLabelText('Points for forfeit win')).toHaveValue(2)
  })

  it('prefills every field from initialValues, including bonus thresholds', () => {
    render(<PlayingConditionsForm initialValues={savedValues} onSubmit={vi.fn()} pending={false} />)

    expect(screen.getByLabelText('Max overs per innings')).toHaveValue(20)
    expect(screen.getByLabelText('Powerplay overs')).toHaveValue(6)
    expect(screen.getByLabelText('Max overs per bowler')).toHaveValue(4)
    expect(screen.getByLabelText('Fielding restrictions notes')).toHaveValue(
      'Two fielders outside the circle in the powerplay.',
    )
    expect(screen.getByLabelText('Points for win')).toHaveValue(4)
    expect(screen.getByLabelText(/enable bonus points/i)).toBeChecked()
    expect(screen.getByLabelText('Early-chase overs threshold')).toHaveValue(17)
    expect(screen.getByLabelText('Bowling restriction %')).toHaveValue(80)
    expect(screen.getByLabelText('Additional notes')).toHaveValue('DLS applies for rain-affected matches.')
  })

  it('does not render the bonus threshold fields at all while the checkbox is unchecked', () => {
    render(<PlayingConditionsForm onSubmit={vi.fn()} pending={false} />)

    expect(screen.queryByLabelText('Early-chase overs threshold')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bowling restriction %')).not.toBeInTheDocument()
  })

  it('mounts the bonus threshold fields once the checkbox is checked', async () => {
    const user = userEvent.setup()
    render(<PlayingConditionsForm onSubmit={vi.fn()} pending={false} />)

    await user.click(screen.getByLabelText(/enable bonus points/i))

    expect(screen.getByLabelText('Early-chase overs threshold')).toBeInTheDocument()
    expect(screen.getByLabelText('Bowling restriction %')).toBeInTheDocument()
  })

  it('shows a live "(auto: N)" hint for max overs per bowler once innings overs is entered', async () => {
    const user = userEvent.setup()
    render(<PlayingConditionsForm onSubmit={vi.fn()} pending={false} />)

    await user.type(screen.getByLabelText('Max overs per innings'), '20')

    expect(screen.getByText(/\(auto: 4\)/)).toBeInTheDocument()
  })

  it('blocks submit and shows an inline error when powerplayOvers exceeds maxOversPerInnings', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PlayingConditionsForm onSubmit={onSubmit} pending={false} />)

    await user.clear(screen.getByLabelText('Max overs per innings'))
    await user.type(screen.getByLabelText('Max overs per innings'), '10')
    await user.clear(screen.getByLabelText('Powerplay overs'))
    await user.type(screen.getByLabelText('Powerplay overs'), '15')
    await user.click(screen.getByRole('button', { name: 'Save Playing Conditions' }))

    expect(await screen.findByText('Must be less than or equal to max overs per innings')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks submit when bonus points are enabled but a threshold is missing', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PlayingConditionsForm onSubmit={onSubmit} pending={false} />)

    await fillRequiredFields(user)
    await user.click(screen.getByLabelText(/enable bonus points/i))
    await user.click(screen.getByRole('button', { name: 'Save Playing Conditions' }))

    expect(
      await screen.findByText('Both bonus-point fields are required while bonus points are enabled'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the exact expected payload shape, nulling optional blanks', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PlayingConditionsForm onSubmit={onSubmit} pending={false} />)

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Save Playing Conditions' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as PlayingConditionsPayload
    expect(payload).toEqual({
      maxOversPerInnings: 20,
      powerplayOvers: 6,
      maxOversPerBowler: null,
      fieldingRestrictionsNotes: null,
      pointsForWin: 2,
      pointsForLoss: 0,
      pointsForDraw: 1,
      pointsForNoResult: 1,
      pointsForForfeitWin: 2,
      bonusPointsEnabled: false,
      bonusBattingOversThreshold: null,
      bonusBowlingRestrictionPercentage: null,
      additionalNotes: null,
    })
  })

  it('submits enabled bonus points with both thresholds populated', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PlayingConditionsForm onSubmit={onSubmit} pending={false} />)

    await fillRequiredFields(user)
    await user.click(screen.getByLabelText(/enable bonus points/i))
    await user.type(screen.getByLabelText('Early-chase overs threshold'), '17')
    await user.type(screen.getByLabelText('Bowling restriction %'), '80')
    await user.click(screen.getByRole('button', { name: 'Save Playing Conditions' }))

    const payload = onSubmit.mock.calls[0][0] as PlayingConditionsPayload
    expect(payload.bonusPointsEnabled).toBe(true)
    expect(payload.bonusBattingOversThreshold).toBe(17)
    expect(payload.bonusBowlingRestrictionPercentage).toBe(80)
  })

  it('shows the pending label and disables Save while pending', () => {
    render(<PlayingConditionsForm onSubmit={vi.fn()} pending />)

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('surfaces the error prop as an inline message', () => {
    render(<PlayingConditionsForm onSubmit={vi.fn()} pending={false} error={new Error('boom')} />)

    expect(
      screen.getByText('Something went wrong saving Playing Conditions. Please try again.'),
    ).toBeInTheDocument()
  })
})
