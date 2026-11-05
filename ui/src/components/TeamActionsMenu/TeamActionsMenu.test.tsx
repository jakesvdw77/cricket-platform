import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TeamActionsMenu } from './TeamActionsMenu'
import { baseTheme } from '../../theme'

function renderMenu(props: Partial<Parameters<typeof TeamActionsMenu>[0]> = {}) {
  render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter initialEntries={['/manage/teams?focus=empty']}>
        <TeamActionsMenu
          teamName="1st XI"
          openTo="/manage/sections/s1/teams/t1"
          editTo="/manage/sections/s1/teams/t1/edit"
          statsTo="/manage/teams/t1/stats"
          {...props}
        />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

// docs/specs/142: the one actions menu of a team, a row/card kebab or the Team page's Manage Team button
describe('TeamActionsMenu', () => {
  it('is a kebab named for the team, with Open Team, Edit Team, View Stats and View Squad', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for 1st XI' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Team', 'Edit Team', 'View Stats', 'View Squad'])
  })

  it('carries returnTo with the origin label and the current view on every link', async () => {
    renderMenu({ originLabel: 'Teams' })
    await userEvent.click(screen.getByRole('button', { name: 'Actions for 1st XI' }))
    for (const name of ['Open Team', 'Edit Team', 'View Stats', 'View Squad']) {
      const href = screen.getByRole('menuitem', { name }).getAttribute('href') as string
      expect(href).toContain('returnTo=')
      expect(decodeURIComponent(href)).toContain('focus=empty')
      expect(href).toContain('returnLabel=Teams')
    }
  })

  it('points View Squad at the squad section of the team page', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for 1st XI' }))
    const href = screen.getByRole('menuitem', { name: 'View Squad' }).getAttribute('href') as string
    expect(href.startsWith('/manage/sections/s1/teams/t1?')).toBe(true)
    expect(href.endsWith('#squad')).toBe(true)
  })

  it('as the Manage Team button, without openTo, it has only Edit Team and View Stats', async () => {
    renderMenu({ trigger: 'button', openTo: undefined, originLabel: 'Team' })
    await userEvent.click(screen.getByRole('button', { name: 'Manage Team' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Edit Team', 'View Stats'])
    expect(screen.getByRole('menuitem', { name: 'Edit Team' }).getAttribute('href')).toContain('returnLabel=Team')
  })
})
