import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../theme'
import { LinkButton } from './LinkButton'

function renderButton(props: Partial<Parameters<typeof LinkButton>[0]> = {}) {
  const onClick = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <LinkButton onClick={onClick} {...props} />
    </ThemeProvider>,
  )
  return onClick
}

describe('LinkButton', () => {
  it('reads Link, is named "Link to player" and calls onClick', async () => {
    const onClick = renderButton()
    const button = screen.getByRole('button', { name: 'Link to player' })
    expect(button).toHaveTextContent('Link')
    await userEvent.setup().click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('takes another accessible name and can be disabled', () => {
    renderButton({ ariaLabel: 'Choose the player for Dino V', disabled: true })
    expect(screen.getByRole('button', { name: 'Choose the player for Dino V' })).toBeDisabled()
  })
})
