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

  it('draws a visible heading by default and keeps it only as the list name with hideTitle', () => {
    const items = [{ key: 'a', label: '34' }]
    const { rerender } = render(<FormStrip title="Bowling, last 5 spells" items={items} />)
    expect(screen.getByText('Bowling, last 5 spells', { selector: 'p' })).toBeInTheDocument()
    rerender(<FormStrip title="Bowling, last 5 spells" items={items} hideTitle />)
    expect(screen.queryByText('Bowling, last 5 spells', { selector: 'p' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Bowling, last 5 spells' })).toBeInTheDocument()
  })

  it('defaults a chip with no tone to neutral (outlined) and fills the positive and muted ones', () => {
    render(
      <FormStrip
        title="Batting"
        items={[
          { key: 'a', label: '34' },
          { key: 'b', label: '0', tone: 'muted' },
          { key: 'c', label: '56*', tone: 'positive' },
        ]}
      />,
    )
    const tone = (text: string) => screen.getByText(text).closest('[data-tone]') as HTMLElement
    expect(tone('34')).toHaveAttribute('data-tone', 'neutral')
    expect(tone('34').className).toMatch(/MuiChip-outlined/)
    expect(tone('0').className).toMatch(/MuiChip-filled/)
    expect(tone('56*').className).toMatch(/MuiChip-filled/)
  })

  it('shows a star for a not-out score and speaks the aria label when one is given', () => {
    render(<FormStrip title="Batting" items={[{ key: 'a', label: '56*', tone: 'positive', ariaLabel: '56 not out off 40 balls' }]} />)
    expect(screen.getByText('56*')).toBeInTheDocument()
    expect(screen.getByLabelText('56 not out off 40 balls')).toHaveAttribute('data-tone', 'positive')
  })

  it('draws every chip 32 px high with a 40 px minimum width and bold text', () => {
    render(<FormStrip title="Batting" items={[{ key: 'a', label: '4' }, { key: 'b', label: '56*', tone: 'positive' }]} />)
    for (const text of ['4', '56*']) {
      const chip = screen.getByText(text).closest('[data-tone]') as HTMLElement
      expect(getComputedStyle(chip).height).toBe('32px')
      expect(getComputedStyle(chip).minWidth).toBe('40px')
      expect(getComputedStyle(chip).fontWeight).toBe('700')
    }
  })

  it('fills a positive chip with a stronger tint and border than a muted one, and leaves a neutral chip outlined with no fill', () => {
    render(
      <FormStrip
        title="Batting"
        items={[
          { key: 'a', label: '34' },
          { key: 'b', label: '0', tone: 'muted' },
          { key: 'c', label: '56*', tone: 'positive' },
        ]}
      />,
    )
    const style = (text: string) => getComputedStyle(screen.getByText(text).closest('[data-tone]') as HTMLElement)
    expect(style('56*').backgroundColor).not.toBe(style('0').backgroundColor)
    expect(style('56*').borderTopColor).not.toBe(style('34').borderTopColor)
    expect(style('56*').color).not.toBe(style('0').color)
    expect(style('34').backgroundColor).not.toBe(style('56*').backgroundColor)
  })
})
