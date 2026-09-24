import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayingConditionsShareDialog } from './PlayingConditionsShareDialog'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'

const conditions: PlayingConditionsPayload = {
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: null,
  fieldingRestrictionsNotes: null,
  pointsForWin: 2,
  pointsForLoss: 0,
  pointsForDraw: 1,
  pointsForNoResult: 1,
  pointsForForfeitWin: 2,
  bonusPointsEnabled: true,
  bonusBattingOversThreshold: 17,
  bonusBowlingRestrictionPercentage: 80,
  additionalNotes: null,
}

describe('PlayingConditionsShareDialog', () => {
  it('renders an info alert with both footer actions disabled when nothing has been saved yet', () => {
    render(
      <PlayingConditionsShareDialog
        open
        onClose={vi.fn()}
        hasStructuredFields={false}
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={null}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(
      screen.getByText("Save the league's match format, points, and bonus-point rules before sharing a summary."),
    ).toBeInTheDocument()
    expect(screen.queryByText('PDF Summary')).not.toBeInTheDocument()
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open pdf/i })).toBeDisabled()
  })

  it('renders exactly two selectable options and no third placeholder row', () => {
    render(
      <PlayingConditionsShareDialog
        open
        onClose={vi.fn()}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByText('PDF Summary')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument()
    expect(screen.queryByText('Facebook')).not.toBeInTheDocument()
  })

  it('calls onSharePdf and closes the dialog on success', async () => {
    const user = userEvent.setup()
    const onSharePdf = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <PlayingConditionsShareDialog
        open
        onClose={onClose}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={onSharePdf}
      />,
    )

    await user.click(screen.getByRole('button', { name: /open pdf/i }))

    expect(onSharePdf).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a generating state on the PDF footer button while onSharePdf is pending', async () => {
    const user = userEvent.setup()
    let resolveSharePdf: () => void = () => {}
    const onSharePdf = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSharePdf = resolve
        }),
    )
    render(
      <PlayingConditionsShareDialog
        open
        onClose={vi.fn()}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={onSharePdf}
      />,
    )

    await user.click(screen.getByRole('button', { name: /open pdf/i }))

    expect(await screen.findByRole('button', { name: /generating/i })).toBeDisabled()

    resolveSharePdf()
    await screen.findByRole('button', { name: /open pdf/i })
  })

  it('shows an inline error and keeps the dialog open when onSharePdf rejects', async () => {
    const user = userEvent.setup()
    const onSharePdf = vi.fn().mockRejectedValue(new Error('PDF generation failed'))
    const onClose = vi.fn()
    render(
      <PlayingConditionsShareDialog
        open
        onClose={onClose}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={onSharePdf}
      />,
    )

    await user.click(screen.getByRole('button', { name: /open pdf/i }))

    expect(await screen.findByText('PDF generation failed')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('selecting WhatsApp reveals a pre-filled, regeneratable text area', async () => {
    const user = userEvent.setup()
    render(
      <PlayingConditionsShareDialog
        open
        onClose={vi.fn()}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByText('WhatsApp'))

    const textbox = await screen.findByRole('textbox', { name: /whatsapp message/i })
    expect((textbox as HTMLTextAreaElement).value).toContain('Riverside T20 League')
    expect((textbox as HTMLTextAreaElement).value).toContain('Overs per innings: 20')
  })

  it('discards a manual edit and rebuilds from current data when Regenerate is clicked', async () => {
    const user = userEvent.setup()
    render(
      <PlayingConditionsShareDialog
        open
        onClose={vi.fn()}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByText('WhatsApp'))
    const textbox = await screen.findByRole('textbox', { name: /whatsapp message/i })
    const originalValue = (textbox as HTMLTextAreaElement).value

    await user.clear(textbox)
    await user.type(textbox, 'a manual edit')
    expect((textbox as HTMLTextAreaElement).value).toBe('a manual edit')

    await user.click(screen.getByRole('button', { name: /regenerate/i }))

    expect((textbox as HTMLTextAreaElement).value).toBe(originalValue)
  })

  it('"Copy to Clipboard" writes the textbox content to the clipboard and closes, without calling onSharePdf', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onSharePdf = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <PlayingConditionsShareDialog
        open
        onClose={onClose}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={onSharePdf}
      />,
    )

    await user.click(screen.getByText('WhatsApp'))
    const textbox = await screen.findByRole('textbox', { name: /whatsapp message/i })
    const generatedText = (textbox as HTMLTextAreaElement).value

    await user.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    expect(writeText).toHaveBeenCalledWith(generatedText)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSharePdf).not.toHaveBeenCalled()
  })

  it('shows an inline error and keeps the dialog open when the clipboard write rejects', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    const onClose = vi.fn()
    render(
      <PlayingConditionsShareDialog
        open
        onClose={onClose}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByText('WhatsApp'))
    await user.click(screen.getByRole('button', { name: /copy to clipboard/i }))

    expect(await screen.findByText("Couldn't copy to clipboard. Please try again.")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('resets to the PDF option and clears any error when closed and reopened', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <PlayingConditionsShareDialog
        open
        onClose={vi.fn()}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByText('WhatsApp'))
    await screen.findByRole('textbox', { name: /whatsapp message/i })

    rerender(
      <PlayingConditionsShareDialog
        open={false}
        onClose={vi.fn()}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    rerender(
      <PlayingConditionsShareDialog
        open
        onClose={vi.fn()}
        hasStructuredFields
        leagueName="Riverside T20 League"
        seasonLabel="2026"
        conditions={conditions}
        onSharePdf={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.queryByRole('textbox', { name: /whatsapp message/i })).not.toBeInTheDocument()
    expect(screen.getByText('PDF Summary')).toBeInTheDocument()
  })
})
