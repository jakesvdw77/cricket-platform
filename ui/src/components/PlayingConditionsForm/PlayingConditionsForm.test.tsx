import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayingConditionsForm, PLAYING_CONDITIONS_FORM_ID } from './PlayingConditionsForm'
import type { PlayingConditionsFormProps } from './PlayingConditionsForm'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'

const savedValues: PlayingConditionsPayload = {
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: 4,
  maxBallsPerOver: null,
  freeHitOnNoBall: true,
  fieldingRestrictionsNotes: 'Two fielders outside the circle in the powerplay.',
  allowSubstitutions: true,
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

// The Save button lives outside the form (the tab's footer) and submits it through the form id.
function renderForm(props: Partial<PlayingConditionsFormProps> = {}) {
  return render(
    <>
      <PlayingConditionsForm onSubmit={vi.fn()} {...props} />
      <button type="submit" form={PLAYING_CONDITIONS_FORM_ID}>
        Save playing conditions
      </button>
    </>,
  )
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText('Max overs per innings'))
  await user.type(screen.getByLabelText('Max overs per innings'), '20')
  await user.clear(screen.getByLabelText('Powerplay overs'))
  await user.type(screen.getByLabelText('Powerplay overs'), '6')
}

describe('PlayingConditionsForm', () => {
  it('seeds the standard T20 point defaults when no initialValues are provided', () => {
    renderForm()

    expect(screen.getByLabelText('Points for win')).toHaveValue(2)
    expect(screen.getByLabelText('Points for loss')).toHaveValue(0)
    expect(screen.getByLabelText('Points for draw')).toHaveValue(1)
    expect(screen.getByLabelText('Points for no result')).toHaveValue(1)
    expect(screen.getByLabelText('Points for forfeit win')).toHaveValue(2)
  })

  it('prefills every field from initialValues, including bonus thresholds', () => {
    renderForm({ initialValues: savedValues })

    expect(screen.getByLabelText('Max overs per innings')).toHaveValue(20)
    expect(screen.getByLabelText('Powerplay overs')).toHaveValue(6)
    expect(screen.getByLabelText('Max overs per bowler')).toHaveValue(4)
    expect(screen.getByLabelText('Fielding restrictions notes')).toHaveValue(
      'Two fielders outside the circle in the powerplay.',
    )
    expect(screen.getByLabelText('Points for win')).toHaveValue(4)
    expect(screen.getByRole('checkbox', { name: /allow substitutions/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /enable bonus points/i })).toBeChecked()
    expect(screen.getByLabelText('Early-chase overs threshold')).toHaveValue(17)
    expect(screen.getByLabelText('Bowling restriction %')).toHaveValue(80)
    expect(screen.getByLabelText('Additional notes')).toHaveValue('DLS applies for rain-affected matches.')
  })

  it('does not render the bonus threshold fields at all while the switch is off', () => {
    renderForm()

    expect(screen.queryByLabelText('Early-chase overs threshold')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bowling restriction %')).not.toBeInTheDocument()
  })

  it('mounts the bonus threshold fields once the switch is on', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('checkbox', { name: /enable bonus points/i }))

    expect(screen.getByLabelText('Early-chase overs threshold')).toBeInTheDocument()
    expect(screen.getByLabelText('Bowling restriction %')).toBeInTheDocument()
  })

  it('shows the effective max overs per bowler as a live "Auto (N)" placeholder, not as helper text', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByLabelText('Max overs per bowler')).toHaveAttribute('placeholder', 'Auto')
    await user.type(screen.getByLabelText('Max overs per innings'), '20')

    expect(screen.getByLabelText('Max overs per bowler')).toHaveAttribute('placeholder', 'Auto (4)')
    expect(screen.queryByText(/auto: 4/)).not.toBeInTheDocument()
  })

  it('uses placeholders for the examples and keeps helper text for validation errors only', () => {
    renderForm()

    expect(screen.getByLabelText('Max overs per innings')).toHaveAttribute('placeholder', 'e.g. 20')
    expect(screen.getByLabelText('Powerplay overs')).toHaveAttribute('placeholder', 'e.g. 6')
    expect(screen.queryByText('e.g. 20 for a T20 league')).not.toBeInTheDocument()
  })

  it('carries the long explanations verbatim in info-icon tooltips', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.hover(screen.getByLabelText('About fielding restrictions notes'))
    expect(
      await screen.findByText('Optional: free text for circle/leg-side clauses too varied to model as fields'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /enable bonus points/i }))
    await user.hover(screen.getByLabelText('About the early-chase overs threshold'))
    expect(
      await screen.findByText('e.g. 17: the batting-second side earns a bonus point for chasing before this over'),
    ).toBeInTheDocument()
  })

  it('has the four section headings and no Save button inside the form', () => {
    renderForm()

    for (const name of ['Innings', 'Points', 'Bonus points', 'Notes']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
    const form = document.getElementById(PLAYING_CONDITIONS_FORM_ID) as HTMLFormElement
    expect(form.querySelector('button')).toBeNull()
  })

  it('blocks submit and shows an inline error when powerplayOvers exceeds maxOversPerInnings', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })

    await user.clear(screen.getByLabelText('Max overs per innings'))
    await user.type(screen.getByLabelText('Max overs per innings'), '10')
    await user.clear(screen.getByLabelText('Powerplay overs'))
    await user.type(screen.getByLabelText('Powerplay overs'), '15')
    await user.click(screen.getByRole('button', { name: 'Save playing conditions' }))

    expect(await screen.findByText('Must be less than or equal to max overs per innings')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('blocks submit when bonus points are enabled but a threshold is missing', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })

    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: /enable bonus points/i }))
    await user.click(screen.getByRole('button', { name: 'Save playing conditions' }))

    expect(
      await screen.findByText('Both bonus-point fields are required while bonus points are enabled'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the exact expected payload shape, nulling optional blanks', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: 'Save playing conditions' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as PlayingConditionsPayload
    expect(payload).toEqual({
      maxOversPerInnings: 20,
      powerplayOvers: 6,
      maxOversPerBowler: null,
      maxBallsPerOver: null,
      freeHitOnNoBall: true,
      fieldingRestrictionsNotes: null,
      allowSubstitutions: false,
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

  it('toggling "Allow substitutions" is reflected in the submitted payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })

    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: /allow substitutions/i }))
    await user.click(screen.getByRole('button', { name: 'Save playing conditions' }))

    const payload = onSubmit.mock.calls[0][0] as PlayingConditionsPayload
    expect(payload.allowSubstitutions).toBe(true)
  })

  it('submits enabled bonus points with both thresholds populated', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })

    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: /enable bonus points/i }))
    await user.type(screen.getByLabelText('Early-chase overs threshold'), '17')
    await user.type(screen.getByLabelText('Bowling restriction %'), '80')
    await user.click(screen.getByRole('button', { name: 'Save playing conditions' }))

    const payload = onSubmit.mock.calls[0][0] as PlayingConditionsPayload
    expect(payload.bonusPointsEnabled).toBe(true)
    expect(payload.bonusBattingOversThreshold).toBe(17)
    expect(payload.bonusBowlingRestrictionPercentage).toBe(80)
  })
})

// docs/specs/124: the optional balls-per-over limit and the free hit rule.
describe('PlayingConditionsForm balls per over and free hit', () => {
  const save = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Save playing conditions' }))

  it('hides the number while the limit is off and shows it, empty, when the switch is turned on', async () => {
    const user = userEvent.setup()
    renderForm()
    expect(screen.queryByLabelText('Maximum balls per over')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))

    expect(screen.getByLabelText('Maximum balls per over')).toHaveValue(null)
  })

  it('clears the number when the switch is turned off, so a null is submitted', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))
    await user.type(screen.getByLabelText('Maximum balls per over'), '8')
    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))
    expect(screen.queryByLabelText('Maximum balls per over')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))
    expect(screen.getByLabelText('Maximum balls per over')).toHaveValue(null)
    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))
    await save(user)

    expect((onSubmit.mock.calls[0][0] as PlayingConditionsPayload).maxBallsPerOver).toBeNull()
  })

  it('prefills the switch and number from a saved limit and submits the number', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit, initialValues: { ...savedValues, maxBallsPerOver: 8 } })

    expect(screen.getByRole('checkbox', { name: /limit balls per over/i })).toBeChecked()
    expect(screen.getByLabelText('Maximum balls per over')).toHaveValue(8)
    await save(user)

    expect((onSubmit.mock.calls[0][0] as PlayingConditionsPayload).maxBallsPerOver).toBe(8)
  })

  it.each(['0', '21'])('blocks submit when the limit is %s, outside 1 to 20', async (value) => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))
    await user.type(screen.getByLabelText('Maximum balls per over'), value)
    await save(user)

    expect(await screen.findByText('Enter a whole number from 1 to 20')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each(['1', '20'])('accepts %s, the bounds of the limit', async (value) => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))
    await user.type(screen.getByLabelText('Maximum balls per over'), value)
    await save(user)

    expect((onSubmit.mock.calls[0][0] as PlayingConditionsPayload).maxBallsPerOver).toBe(Number(value))
  })

  it('blocks submit when the limit is on but the number is empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })
    await fillRequiredFields(user)
    await user.click(screen.getByRole('checkbox', { name: /limit balls per over/i }))
    await save(user)

    expect(await screen.findByText('Enter a whole number from 1 to 20')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('has the free hit switch on by default and submits false once it is turned off', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit })
    const freeHit = screen.getByRole('checkbox', { name: /free hit after a no ball/i })
    expect(freeHit).toBeChecked()

    await fillRequiredFields(user)
    await user.click(freeHit)
    await save(user)

    expect((onSubmit.mock.calls[0][0] as PlayingConditionsPayload).freeHitOnNoBall).toBe(false)
  })
})
