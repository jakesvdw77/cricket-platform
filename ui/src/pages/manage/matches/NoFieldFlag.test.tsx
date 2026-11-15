import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NoFieldFlag, showsNoFieldFlag } from './NoFieldFlag'

describe('NoFieldFlag (spec 151 slice I)', () => {
  it('shows only for venue text with no linked field', () => {
    expect(showsNoFieldFlag({ venue: 'Pen Basson, Wellington', playingAreaId: null })).toBe(true)
    expect(showsNoFieldFlag({ venue: 'Durbanville CC A', playingAreaId: 'abc' })).toBe(false)
    expect(showsNoFieldFlag({ venue: '  ', playingAreaId: null })).toBe(false)
    expect(showsNoFieldFlag({ venue: null, playingAreaId: null })).toBe(false)
    expect(showsNoFieldFlag({})).toBe(false)
  })

  it('renders the amber tag text', () => {
    render(<NoFieldFlag />)
    expect(screen.getByTestId('match-no-field-flag')).toHaveTextContent('No Field')
  })
})
