import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormStrip } from './FormStrip'

describe('FormStrip', () => {
  it('shows one chip per item in the order given, with its tone', () => {
    render(
      <FormStrip
        title="Batting, last 5 innings"
        items={[
          { key: 'a', label: '34' },
          { key: 'b', label: '0', tone: 'muted' },
          { key: 'c', label: '56*', tone: 'positive' },
        ]}
      />,
    )
    const chips = screen.getAllByRole('listitem')
    expect(chips.map((chip) => chip.textContent)).toEqual(['34', '0', '56*'])
    expect(screen.getByText('56*').closest('[data-tone]')).toHaveAttribute('data-tone', 'positive')
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<FormStrip title="Bowling" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
