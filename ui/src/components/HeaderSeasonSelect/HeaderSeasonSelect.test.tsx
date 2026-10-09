import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HeaderSeasonSelect } from './HeaderSeasonSelect'

const seasons = [
  { id: 's1', name: '2026/2027' },
  { id: 's2', name: '2025/2026' },
]

describe('HeaderSeasonSelect', () => {
  it('shows the chosen season, or "All seasons" for none', () => {
    const { rerender } = render(<HeaderSeasonSelect seasons={seasons} value="s1" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2026/2027')
    rerender(<HeaderSeasonSelect seasons={seasons} value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('All seasons')
  })

  it('opens a list with All seasons first and the current one selected', async () => {
    render(<HeaderSeasonSelect seasons={seasons} value="s2" onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Season' }))
    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['All seasons', '2026/2027', '2025/2026'])
    expect(options[2]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('reports the picked season and null for All seasons, and closes the menu', async () => {
    const onChange = vi.fn()
    render(<HeaderSeasonSelect seasons={seasons} value="s1" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Season' }))
    await userEvent.click(screen.getByRole('option', { name: '2025/2026' }))
    expect(onChange).toHaveBeenLastCalledWith('s2')
    await userEvent.click(screen.getByRole('button', { name: 'Season' }))
    await userEvent.click(screen.getByRole('option', { name: 'All seasons' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  // docs/specs/091: the Leagues page has no "All seasons".
  it('can drop the All seasons row', async () => {
    render(<HeaderSeasonSelect seasons={seasons} value="s1" onChange={vi.fn()} showAll={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Season' }))
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['2026/2027', '2025/2026'])
  })
})
