import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it, vi } from 'vitest'
import { CompactSwitch } from './CompactSwitch'
import { baseTheme } from '../../theme'

function renderSwitch(props: Partial<React.ComponentProps<typeof CompactSwitch>> = {}) {
  const onChange = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <CompactSwitch checked={false} onChange={onChange} label="Show closed polls" {...props} />
    </ThemeProvider>,
  )
  return onChange
}

describe('CompactSwitch', () => {
  it('is a labelled small switch', () => {
    renderSwitch()

    const toggle = screen.getByRole('checkbox', { name: 'Show closed polls' })
    expect(toggle).not.toBeChecked()
    expect(toggle.closest('.MuiSwitch-root')).toHaveClass('MuiSwitch-sizeSmall')
  })

  it('uses a caption-size label', () => {
    renderSwitch()

    expect(getComputedStyle(screen.getByText('Show closed polls')).fontSize).toBe('0.8rem')
  })

  it('reports the new state on click', async () => {
    const onChange = renderSwitch()

    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('can be disabled', () => {
    renderSwitch({ disabled: true, checked: true })

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('has a 44 px high row on a phone', () => {
    renderSwitch()

    const label = screen.getByText('Show closed polls').closest('label') as HTMLElement
    const css = Array.from(document.querySelectorAll('style'))
      .flatMap((style) => Array.from(style.sheet?.cssRules ?? []))
      .map((rule) => rule.cssText)
      .filter((text) => Array.from(label.classList).some((name) => text.includes(`.${name}`)))
      .join('\n')
    expect(css).toMatch(/min-height:\s*44px/)
    expect(css).toMatch(/@media \(min-width:\s*600px\)[^]*min-height:\s*28px/)
  })
})
