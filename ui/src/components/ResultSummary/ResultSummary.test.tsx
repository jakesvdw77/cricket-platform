import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResultSummary } from './ResultSummary'

const sides = [
  { key: 'HOME', name: '1st XI', winner: true, logo: <span data-testid="logo-home" />, innings: [{ kind: 'REGULAR' as const, battingSide: 'HOME' as const, runs: 212, wickets: 6, balls: 240 }] },
  { key: 'AWAY', name: 'Riverside', innings: [] },
]

describe('ResultSummary', () => {
  it('renders both sides, the score, the logo and the result line', () => {
    render(<ResultSummary sides={sides} ballsPerOver={6} resultLine="1st XI won" perspective="won">detail row</ResultSummary>)

    expect(screen.getByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('Riverside')).toBeInTheDocument()
    expect(screen.getByText('212/6 (40.0)')).toBeInTheDocument()
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(screen.getByTestId('logo-home')).toBeInTheDocument()
    expect(screen.getByTestId('result-line')).toHaveTextContent('1st XI won')
    expect(screen.getByTestId('result-line')).toHaveAttribute('data-perspective', 'won')
    expect(screen.getByText('detail row')).toBeInTheDocument()
  })
})
