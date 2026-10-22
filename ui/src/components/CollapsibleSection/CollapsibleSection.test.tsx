import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it, vi } from 'vitest'
import { CollapsibleSection } from './CollapsibleSection'
import type { CollapsibleSectionProps } from './CollapsibleSection'
import { baseTheme } from '../../theme'

function renderSection(props: Partial<CollapsibleSectionProps> = {}) {
  const onToggle = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <CollapsibleSection title="Batting" testId="batting" open onToggle={onToggle} {...props}>
        <p>inside</p>
      </CollapsibleSection>
    </ThemeProvider>,
  )
  return onToggle
}

describe('CollapsibleSection', () => {
  it('names the region by its title, an h2', () => {
    renderSection()
    expect(screen.getByRole('heading', { level: 2, name: 'Batting' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Batting' })).toBeInTheDocument()
  })

  it('open: a "Hide" button that is expanded, controls the content, and the content shows', () => {
    renderSection()
    const button = screen.getByTestId('batting-toggle')
    expect(button).toHaveTextContent('Hide batting')
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(button.getAttribute('aria-controls') as string)).toContainElement(screen.getByText('inside'))
    expect(screen.getByText('inside')).toBeVisible()
  })

  it('collapsed: a "Show" button, nothing rendered below the header, and the content element hidden', () => {
    renderSection({ open: false })
    const button = screen.getByTestId('batting-toggle')
    expect(button).toHaveTextContent('Show batting')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('inside')).not.toBeInTheDocument()
    expect(document.getElementById(button.getAttribute('aria-controls') as string)).toHaveAttribute('hidden')
  })

  it('the button is at least 44 px tall and asks the caller to toggle', async () => {
    const onToggle = renderSection()
    const button = screen.getByTestId('batting-toggle')
    expect(button).toHaveStyle({ minHeight: '44px' })
    await userEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('swaps the icon with the state and hides it from assistive technology', () => {
    const { unmount } = render(
      <ThemeProvider theme={baseTheme}>
        <CollapsibleSection title="A" testId="a" open onToggle={() => undefined} />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('ExpandLessIcon')).toHaveAttribute('aria-hidden', 'true')
    unmount()
    render(
      <ThemeProvider theme={baseTheme}>
        <CollapsibleSection title="A" testId="a" open={false} onToggle={() => undefined} />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('ExpandMoreIcon')).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses a custom label noun and links an optional description to the section', () => {
    renderSection({ title: 'Overview', label: 'overview', description: 'Same filters as above' })
    expect(screen.getByTestId('batting-toggle')).toHaveTextContent('Hide overview')
    expect(screen.getByRole('region', { name: 'Overview' })).toHaveAccessibleDescription('Same filters as above')
  })
})
