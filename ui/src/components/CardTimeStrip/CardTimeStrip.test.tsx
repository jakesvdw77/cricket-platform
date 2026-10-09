import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardTimeStrip } from './CardTimeStrip'

describe('CardTimeStrip (docs/specs/087)', () => {
  it('shows the icon, label and bold value in one strip, neutral by default', () => {
    render(<CardTimeStrip testId="strip" icon={<svg data-testid="icon" />} label="Starts" value="Sat 10 Oct · 13:00" />)
    const strip = screen.getByTestId('strip')
    expect(strip).toHaveAttribute('data-tone', 'neutral')
    expect(strip).toContainElement(screen.getByTestId('icon'))
    expect(strip).toContainElement(screen.getByText('Starts'))
    expect(strip).toContainElement(screen.getByText('Sat 10 Oct · 13:00'))
  })

  it('is amber in the warning tone', () => {
    render(<CardTimeStrip testId="strip" tone="warning" icon={<svg />} label="Starts" value="Today" />)
    expect(screen.getByTestId('strip')).toHaveAttribute('data-tone', 'warning')
  })

  it('renders the action after the value and the trailing node, and omits them when not given', () => {
    const { rerender } = render(
      <CardTimeStrip icon={<svg />} label="Poll closes" value="Fri" action={<button type="button">Edit close time</button>} trailing={<span>7 h left</span>} />,
    )
    const value = screen.getByText('Fri')
    expect(value.compareDocumentPosition(screen.getByRole('button', { name: 'Edit close time' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('7 h left')).toBeInTheDocument()

    rerender(<CardTimeStrip icon={<svg />} label="Poll closes" value="Fri" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('7 h left')).not.toBeInTheDocument()
  })
})
