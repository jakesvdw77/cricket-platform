import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayerKeyFigures } from './PlayerKeyFigures'
import type { Player } from '../../../api/playerApi'

const now = new Date('2026-10-09T12:00:00')
const base = { gamesThisSeason: 12, gamesOverall: 48, jerseyNumber: 9, dateOfBirth: '1980-01-01' } as Player

function figure(id: string) {
  return screen.getByTestId(`key-figure-${id}-value`).textContent
}

describe('PlayerKeyFigures', () => {
  it('shows the games, jersey number and age with the birth date', () => {
    render(<PlayerKeyFigures player={base} now={now} />)
    expect(figure('season')).toBe('12')
    expect(figure('overall')).toBe('48')
    expect(figure('jersey')).toBe('#9')
    expect(figure('age')).toBe('46')
    expect(screen.getByText('Games this season')).toBeInTheDocument()
    expect(screen.getByText('Age · born 1 Jan 1980')).toBeInTheDocument()
  })

  it('shows dashes for no jersey number and no date of birth', () => {
    render(<PlayerKeyFigures player={{ ...base, jerseyNumber: null, dateOfBirth: null }} now={now} />)
    expect(figure('jersey')).toBe('–')
    expect(figure('age')).toBe('–')
    expect(screen.getByText('No date of birth')).toBeInTheDocument()
  })

  it('shows 0 games, not a dash', () => {
    render(<PlayerKeyFigures player={{ ...base, gamesThisSeason: 0, gamesOverall: 0 }} now={now} />)
    expect(figure('season')).toBe('0')
    expect(figure('overall')).toBe('0')
  })
})
