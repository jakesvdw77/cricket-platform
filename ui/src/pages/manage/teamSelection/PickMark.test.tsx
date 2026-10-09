import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PickMark } from './PickMark'

describe('PickMark', () => {
  it('shows a tick when picked', () => {
    render(<PickMark picked />)
    expect(screen.getByTestId('pick-mark')).toHaveTextContent('✓')
    expect(screen.getByTestId('pick-mark')).toHaveAttribute('data-picked', 'true')
  })

  it('shows an empty circle when not picked', () => {
    render(<PickMark picked={false} />)
    expect(screen.getByTestId('pick-mark')).toBeEmptyDOMElement()
    expect(screen.getByTestId('pick-mark')).toHaveAttribute('data-picked', 'false')
  })
})
