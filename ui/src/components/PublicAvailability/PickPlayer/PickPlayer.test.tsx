import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PickPlayer } from './PickPlayer'

const candidates = [
  { playerId: 'a', shirtNumber: 7, teamLabel: 'Villagers 1' },
  { playerId: 'b', shirtNumber: null, teamLabel: 'Villagers 2' },
  { playerId: 'c', shirtNumber: null, teamLabel: null },
]

describe('PickPlayer', () => {
  it('lists each candidate with shirt number and team label', () => {
    render(<PickPlayer firstName="Liam" lastName="Carter" candidates={candidates} onPick={vi.fn()} />)
    expect(screen.getAllByText('Liam Carter')).toHaveLength(3)
    expect(screen.getByText('#7 · Villagers 1')).toBeInTheDocument()
    expect(screen.getByText('Villagers 2')).toBeInTheDocument()
    expect(screen.getByText('No shirt number or team')).toBeInTheDocument()
  })

  it('reports the chosen player id', async () => {
    const onPick = vi.fn()
    render(<PickPlayer firstName="Liam" lastName="Carter" candidates={candidates} onPick={onPick} />)
    await userEvent.click(screen.getByRole('button', { name: /#7 · Villagers 1/ }))
    expect(onPick).toHaveBeenCalledWith('a')
  })

  it('offers Back when given a handler', async () => {
    const onBack = vi.fn()
    render(<PickPlayer firstName="Liam" lastName="Carter" candidates={candidates} onPick={vi.fn()} onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('disables the choices while working', () => {
    render(<PickPlayer firstName="Liam" lastName="Carter" candidates={candidates} onPick={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: /#7 · Villagers 1/ })).toBeDisabled()
  })
})
