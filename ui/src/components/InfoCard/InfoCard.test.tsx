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
})
