import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoverageBar } from './CoverageBar'
import { coverageBarLabel } from './coverageBarParts'

const segments = (container: HTMLElement) => ({
  own: container.querySelector('[data-segment="own"]') as HTMLElement,
  shared: container.querySelector('[data-segment="shared"]') as HTMLElement,
})

describe('CoverageBar (docs/specs/074 section 6.3)', () => {
  it('labels the numbers: available, only this team, also another team, needed', () => {
    render(<CoverageBar teamName="Villagers 1" available={15} ownOnly={9} shared={6} needed={11} />)
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Villagers 1: 15 available, 9 only this team, 6 also available for another team, 11 needed',
    )
  })

  it('uses the shorter forms when nothing is shared or needed is unknown', () => {
    expect(coverageBarLabel({ teamName: 'V1', available: 13, ownOnly: 13, shared: 0, needed: 11 })).toBe('V1: 13 available, 11 needed')
    expect(coverageBarLabel({ teamName: 'V1', available: 13, ownOnly: 11, shared: 2, needed: null })).toBe(
      'V1: 13 available, 11 only this team, 2 also available for another team',
    )
    expect(coverageBarLabel({ teamName: 'V1', available: 2, ownOnly: 2, shared: 0, needed: null })).toBe('V1: 2 available')
  })

  it('sizes the segments and the tick by available when available is the larger', () => {
    const { container } = render(<CoverageBar teamName="V1" available={20} ownOnly={15} shared={5} needed={10} />)
    const { own, shared } = segments(container)
    expect(own).toHaveStyle({ width: '75%' })
    expect(shared).toHaveStyle({ width: '25%' })
    expect(screen.getByTestId('coverage-tick')).toHaveStyle({ left: 'calc(50% - 1px)' })
  })

  it('puts the tick at the right edge when needed is the larger', () => {
    const { container } = render(<CoverageBar teamName="V1" available={5} ownOnly={4} shared={1} needed={10} />)
    const { own, shared } = segments(container)
    expect(own).toHaveStyle({ width: '40%' })
    expect(shared).toHaveStyle({ width: '10%' })
    expect(screen.getByTestId('coverage-tick')).toHaveStyle({ left: 'calc(100% - 1px)' })
  })

  it('has no tick without a needed size, and scales to available', () => {
    const { container } = render(<CoverageBar teamName="V1" available={4} ownOnly={4} shared={0} needed={null} />)
    expect(screen.queryByTestId('coverage-tick')).not.toBeInTheDocument()
    expect(segments(container).own).toHaveStyle({ width: '100%' })
  })

  it('shows an empty track for a team with no poll', () => {
    const { container } = render(<CoverageBar teamName="V2" available={0} ownOnly={0} shared={0} needed={11} hasPoll={false} />)
    expect(screen.queryByTestId('coverage-tick')).not.toBeInTheDocument()
    expect(segments(container).own).toHaveStyle({ width: '0%' })
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'V2: no poll yet, 11 needed')
  })
})
