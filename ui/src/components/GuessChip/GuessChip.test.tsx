import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../theme'
import { GuessChip } from './GuessChip'
import type { GuessChipProps } from './GuessChip'

function renderChip(props: Partial<GuessChipProps> = {}) {
  const onConfirm = vi.fn()
  const onChange = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <GuessChip importedName="Hugo K" level="NORMALISED" matchedName="Hugo Kemp" reason="by the start of the surname" onConfirm={onConfirm} onChange={onChange} {...props} />
    </ThemeProvider>,
  )
  return { onConfirm, onChange }
}

describe('GuessChip', () => {
  it('shows a Guess chip that names what the file said and who it was matched to', () => {
    renderChip()
    const chip = screen.getByRole('button', { name: 'Guess: file said Hugo K, matched to Hugo Kemp. Check this player' })
    expect(chip).toHaveTextContent('Guess')
  })

  it('opens a popover saying what the file said, who it became and why', async () => {
    const user = userEvent.setup()
    renderChip()
    await user.click(screen.getByRole('button', { name: /^Guess:/ }))

    const popover = await screen.findByRole('presentation')
    expect(within(popover).getByText('Check this player')).toBeInTheDocument()
    expect(popover).toHaveTextContent("File said 'Hugo K'. Matched to Hugo Kemp by the start of the surname.")
  })

  it('Confirm closes the popover and confirms, without opening the picker', async () => {
    const user = userEvent.setup()
    const { onConfirm, onChange } = renderChip()
    await user.click(screen.getByRole('button', { name: /^Guess:/ }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Change closes the popover and asks for the picker', async () => {
    const user = userEvent.setup()
    const { onConfirm, onChange } = renderChip()
    await user.click(screen.getByRole('button', { name: /^Guess:/ }))
    await user.click(await screen.findByRole('button', { name: 'Change' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('offers no Confirm when there is nothing to confirm', async () => {
    const user = userEvent.setup()
    renderChip({ onConfirm: undefined })
    await user.click(screen.getByRole('button', { name: /^Guess:/ }))
    await screen.findByRole('button', { name: 'Change' })
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
  })

  it('words a reserved AI level as a suggestion', async () => {
    const user = userEvent.setup()
    renderChip({ level: 'AI_SUGGESTED' })
    await user.click(screen.getByRole('button', { name: /^Guess:/ }))
    expect(await screen.findByText(/Suggested match:/)).toBeInTheDocument()
  })

  it('draws an unresolved name as a Guest chip whose tap goes straight to the picker', async () => {
    const user = userEvent.setup()
    const { onChange } = renderChip({ level: 'UNRESOLVED', importedName: 'Dino V', matchedName: null })
    const chip = screen.getByRole('button', { name: 'Choose the player for Dino V' })
    expect(chip).toHaveTextContent('Guest')

    await user.click(chip)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Check this player')).not.toBeInTheDocument()
  })

  it('is disabled, so a tap opens nothing', () => {
    renderChip({ disabled: true })
    expect(screen.getByRole('button', { name: /^Guess:/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('carries the key a page uses to find the chip', () => {
    renderChip({ guessKey: 'row-7' })
    expect(screen.getByRole('button', { name: /^Guess:/ })).toHaveAttribute('data-guess-key', 'row-7')
  })
})
