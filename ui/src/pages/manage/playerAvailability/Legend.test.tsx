import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Legend } from './Legend'

describe('Legend', () => {
  it('lists the six marks in one wrapping row', () => {
    render(<Legend />)

    const list = screen.getByRole('list', { name: 'Legend' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(6)
    ;['Available', 'Unsure', 'Unavailable', 'No response', "Not in this game's poll (or no poll)", 'Picked for the match'].forEach((text, index) => {
      expect(items[index]).toHaveTextContent(text)
    })
    expect(getComputedStyle(list)).toMatchObject({ display: 'flex', flexWrap: 'wrap' })
  })

  it('words the not-in-poll entry "No poll" for the phone lists', () => {
    render(<Legend phone />)

    expect(screen.getByText('No poll')).toBeInTheDocument()
    expect(screen.queryByText(/Not in this game/)).not.toBeInTheDocument()
  })
})
