import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PlayerActionsMenu } from './PlayerActionsMenu'
import type { Player } from '../../api/playerApi'
import { baseTheme } from '../../theme'

const player = { id: 'p1', firstName: 'Sipho', lastName: 'Ndlovu', active: true, verificationStatus: 'UNVERIFIED' } as Player

function renderMenu(props: Partial<Parameters<typeof PlayerActionsMenu>[0]> = {}) {
  const onStatusAction = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter initialEntries={['/manage/players?focus=unverified']}>
        <PlayerActionsMenu player={player} onStatusAction={onStatusAction} {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  )
  return { onStatusAction }
}

// docs/specs/141: the one actions menu of a player, a row/card kebab or the Player page's Manage Player button
describe('PlayerActionsMenu', () => {
  it('is a kebab named for the player, with Open, Edit, View Stats and the valid status changes', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Sipho Ndlovu' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Player', 'Edit Player', 'View Stats', 'Verify Player', 'Reject Player'])
  })

  it('carries returnTo with the origin label and the current view on every link', async () => {
    renderMenu({ originLabel: 'Players' })
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Sipho Ndlovu' }))
    for (const name of ['Open Player', 'Edit Player', 'View Stats']) {
      const href = screen.getByRole('menuitem', { name }).getAttribute('href') as string
      expect(href).toContain('returnTo=')
      expect(decodeURIComponent(href)).toContain('focus=unverified')
      expect(href).toContain('returnLabel=Players')
    }
  })

  it('as the Manage Player button it has no Open Player item', async () => {
    renderMenu({ trigger: 'button' })
    await userEvent.click(screen.getByRole('button', { name: 'Manage Player' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Edit Player', 'View Stats', 'Verify Player', 'Reject Player'])
  })

  it('reports a status change to the caller', async () => {
    const { onStatusAction } = renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Sipho Ndlovu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Verify Player' }))
    expect(onStatusAction).toHaveBeenCalledWith('verify')
  })
})
