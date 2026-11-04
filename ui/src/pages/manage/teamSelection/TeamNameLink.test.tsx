import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TeamNameLink } from './TeamNameLink'

describe('TeamNameLink', () => {
  it('links to the team page carrying returnTo and the origin label', () => {
    render(
      <MemoryRouter initialEntries={['/manage/team-selection/matches?past=1']}>
        <TeamNameLink sectionId="s1" teamId="t1" name="Irene Villagers 1" />
      </MemoryRouter>,
    )
    const href = screen.getByRole('link', { name: 'Irene Villagers 1' }).getAttribute('href') as string
    expect(href.startsWith('/manage/sections/s1/teams/t1?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('returnTo')).toBe('/manage/team-selection/matches?past=1')
    expect(params.get('returnLabel')).toBe('Team Selection')
  })
})
