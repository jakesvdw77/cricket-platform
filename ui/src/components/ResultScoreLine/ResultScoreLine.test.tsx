import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResultScoreLine } from './ResultScoreLine'

describe('ResultScoreLine', () => {
  it('writes runs, wickets and overs', () => {
    render(<ResultScoreLine innings={[{ kind: 'REGULAR', battingSide: 'HOME', runs: 212, wickets: 6, balls: 240 }]} />)

    expect(screen.getByText('212/6 (40.0)')).toBeInTheDocument()
  })

  it('appends super overs and shows a dash with no score', () => {
    const { rerender } = render(
      <ResultScoreLine
        innings={[
          { kind: 'REGULAR', battingSide: 'HOME', runs: 200, wickets: 8, balls: 240 },
          { kind: 'SUPER_OVER', battingSide: 'HOME', runs: 12, wickets: 1, balls: 6 },
        ]}
      />,
    )
    expect(screen.getByText('200/8 (40.0) · SO 12/1 (1.0)')).toBeInTheDocument()

    rerender(<ResultScoreLine innings={[]} />)
    expect(screen.getByText('–')).toBeInTheDocument()
  })
})
