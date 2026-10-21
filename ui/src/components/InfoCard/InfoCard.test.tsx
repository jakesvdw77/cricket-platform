import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InfoCard } from './InfoCard'

describe('InfoCard', () => {
  it('renders the heading and label-over-value fields, with a dash for empty values', () => {
    render(
      <InfoCard
        title="Basic info"
        icon={<span />}
        fields={[
          { label: 'Gender', value: 'Male' },
          { label: 'Club membership number', value: null },
          { label: 'Other', value: '' },
        ]}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Basic info' })).toBeInTheDocument()
    const fields = screen.getAllByTestId('player-info-field')
    expect(within(fields[0]).getByText('Male')).toBeInTheDocument()
    expect(within(fields[1]).getByText('–')).toBeInTheDocument()
    expect(within(fields[2]).getByText('–')).toBeInTheDocument()
  })

  it('shows a field caption under its value and lays the fields out in the requested columns', () => {
    render(
      <InfoCard
        title="Stats"
        icon={<span />}
        columns={3}
        fields={[{ label: 'Strike rate', value: '96.30', caption: 'from 9 of 14 innings' }]}
      />,
    )
    expect(screen.getByText('from 9 of 14 innings')).toBeInTheDocument()
    expect(screen.getByTestId('player-info-field').parentElement).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' })
  })

  it('renders chips marking those not on file', () => {
    render(
      <InfoCard
        title="Cricket info"
        icon={<span />}
        chips={[
          { label: 'Bats: Left-handed', on: true },
          { label: 'Wicketkeeper: No', on: false },
        ]}
      />,
    )
    const chips = screen.getAllByTestId('player-info-chip')
    expect(chips.map((chip) => chip.getAttribute('data-on'))).toEqual(['true', 'false'])
  })

  it('renders the note and the actions', () => {
    render(
      <InfoCard title="Stats" icon={<span />} note="More coming soon" actions={<a href="tel:1">Call</a>} />,
    )
    expect(screen.getByText('More coming soon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Call' })).toBeInTheDocument()
  })

  it('renders free children', () => {
    render(
      <InfoCard title="Squad" icon={<span />}>
        <p>Tile grid</p>
      </InfoCard>,
    )
    expect(screen.getByText('Tile grid')).toBeInTheDocument()
  })

  it('renders a header action beside the heading', () => {
    render(<InfoCard title="Club structure" icon={<span />} headerAction={<button type="button">Add section</button>} />)
    expect(screen.getByRole('button', { name: 'Add section' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Club structure' })).toBeInTheDocument()
  })

  it('draws the warning tone with an amber icon tile, and leaves the default card unchanged', () => {
    const { rerender } = render(<InfoCard title="Check these names" icon={<span data-testid="icon" />} testId="card" tone="warning" />)
    const warningIconTile = screen.getByTestId('icon').parentElement as HTMLElement
    const warningBackground = getComputedStyle(warningIconTile).backgroundColor

    rerender(<InfoCard title="Check these names" icon={<span data-testid="icon" />} testId="card" />)
    const defaultBackground = getComputedStyle(screen.getByTestId('icon').parentElement as HTMLElement).backgroundColor
    expect(warningBackground).not.toBe(defaultBackground)
  })

  it('puts the chips above the fields with chipsFirst, and below them by default', () => {
    const props = { title: 'Cricket', icon: <span />, chips: [{ label: 'Bats', on: true }], fields: [{ label: 'Runs', value: '412' }] }
    const { rerender } = render(<InfoCard {...props} />)
    const after = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(after(screen.getByTestId('player-info-field'), screen.getByTestId('player-info-chip'))).toBe(true)

    rerender(<InfoCard {...props} chipsFirst />)
    expect(after(screen.getByTestId('player-info-chip'), screen.getByTestId('player-info-field'))).toBe(true)
  })

  it('draws the field values larger with fieldSize large, and leaves the default size alone', () => {
    const props = { title: 'Cricket', icon: <span />, fields: [{ label: 'Runs', value: '412' }] }
    const { rerender } = render(<InfoCard {...props} />)
    expect(getComputedStyle(screen.getByText('Runs')).fontSize).not.toBe('0.8125rem')
    expect(getComputedStyle(screen.getByText('412')).lineHeight).not.toBe('1.3')

    rerender(<InfoCard {...props} fieldSize="large" />)
    expect(getComputedStyle(screen.getByText('Runs')).fontSize).toBe('0.8125rem')
    expect(getComputedStyle(screen.getByText('412')).lineHeight).toBe('1.3')
  })

  // The responsive column rule lives in media queries, which jsdom does not evaluate: read the rules emotion injected for the grid.
  describe('fieldSize large columns', () => {
    const styleText = () => Array.from(document.querySelectorAll('style')).map((el) => el.textContent ?? '').join('\n')
    const gridCss = () => {
      const grid = screen.getAllByTestId('player-info-field')[0].parentElement as HTMLElement
      const cls = grid.className.split(' ').find((name) => name.startsWith('css-')) as string
      return styleText().split('}').filter((rule) => rule.includes(`.${cls}`)).join('}')
    }
    const fieldsOf = (count: number) => Array.from({ length: count }, (_, i) => ({ label: `F${i}`, value: `${i}` }))

    it('is 2 columns on a phone, 3 from sm and 3 from md with fewer than six fields', () => {
      render(<InfoCard title="Stats" icon={<span />} fieldSize="large" fields={fieldsOf(5)} />)
      const css = gridCss()
      expect(css).toContain('repeat(2, minmax(0, 1fr))')
      expect(css).toContain('repeat(3, minmax(0, 1fr))')
      expect(css).not.toContain('repeat(4, minmax(0, 1fr))')
    })

    it('is 4 columns from md with six or more fields', () => {
      render(<InfoCard title="Stats" icon={<span />} fieldSize="large" fields={fieldsOf(6)} />)
      expect(gridCss()).toContain('repeat(4, minmax(0, 1fr))')
    })

    it('lets columns override the responsive rule, and leaves the default size at 2 columns', () => {
      const { unmount } = render(<InfoCard title="Stats" icon={<span />} fieldSize="large" columns={3} fields={fieldsOf(8)} />)
      expect(screen.getAllByTestId('player-info-field')[0].parentElement).toHaveStyle({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' })
      expect(gridCss()).not.toContain('repeat(4, minmax(0, 1fr))')
      unmount()
      render(<InfoCard title="Stats" icon={<span />} fields={fieldsOf(8)} />)
      expect(screen.getAllByTestId('player-info-field')[0].parentElement).toHaveStyle({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' })
    })
  })

  describe('field emphasis', () => {
    const props = { title: 'Record', icon: <span />, fields: [{ label: 'Won', value: '9', emphasis: 'success' as const }, { label: 'Tied', value: '1' }] }

    it('with fieldSize large, draws an emphasised value larger, in its tone, on a tinted field', () => {
      render(<InfoCard {...props} fieldSize="large" />)
      const [won, tied] = screen.getAllByTestId('player-info-field')
      expect(getComputedStyle(screen.getByText('9')).fontSize).toBe('1.125rem')
      expect(getComputedStyle(screen.getByText('1')).fontSize).toBe('1rem')
      expect(getComputedStyle(screen.getByText('9')).color).not.toBe(getComputedStyle(screen.getByText('1')).color)
      expect(getComputedStyle(won).backgroundColor).not.toBe(getComputedStyle(tied).backgroundColor)
    })

    it('does nothing with the default size', () => {
      render(<InfoCard {...props} />)
      const [won, tied] = screen.getAllByTestId('player-info-field')
      expect(getComputedStyle(screen.getByText('9')).color).toBe(getComputedStyle(screen.getByText('1')).color)
      expect(getComputedStyle(won).backgroundColor).toBe(getComputedStyle(tied).backgroundColor)
    })

    it('shows the dash for an empty emphasised value in the muted colour', () => {
      render(<InfoCard title="Record" icon={<span />} fieldSize="large" fields={[{ label: 'Won', value: null, emphasis: 'success' }, { label: 'Lost', value: '2' }]} />)
      expect(getComputedStyle(screen.getByText('–')).fontWeight).toBe('400')
    })
  })
})
