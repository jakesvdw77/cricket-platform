import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PlayerNameLink } from './PlayerNameLink'

describe('PlayerNameLink', () => {
  it('links to the player page carrying returnTo and the origin label', () => {
    render(
      <MemoryRouter initialEntries={['/manage/availability/players?league=l1']}>
        <PlayerNameLink playerId="p1" name="Anton de Villiers" />
      </MemoryRouter>,
    )
    const href = screen.getByRole('link', { name: 'Anton de Villiers' }).getAttribute('href') as string
    expect(href.startsWith('/manage/players/p1?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('returnTo')).toBe('/manage/availability/players?league=l1')
    expect(params.get('returnLabel')).toBe('Availability')
  })
})
