import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { NameModeToggle } from './NameModeToggle'
import { PlayerName } from '../PlayerName'
import { PLAYER_NAME_MODE_KEY, resetPlayerNameModeForTests } from '../../hooks/usePlayerNameMode'

describe('NameModeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPlayerNameModeForTests()
  })

  it('starts on Full name and switches every PlayerName and the remembered choice', async () => {
    const sam = { id: 'a', firstName: 'Sam', lastName: 'Venter' }
    render(
      <>
        <NameModeToggle />
        <PlayerName person={sam} />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Full name' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Sam Venter')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'First name' }))

    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(localStorage.getItem(PLAYER_NAME_MODE_KEY)).toBe('first')
    expect(screen.getByRole('group', { name: 'Player names' })).toBeInTheDocument()
  })
})
