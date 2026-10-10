import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RowActions } from './RowActions'
import type { RowAction } from './RowActions'
import { baseTheme } from '../../theme'

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
})

function renderRow(actions: RowAction[], onRowClick = vi.fn()) {
  render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter>
        <div onClick={onRowClick} onKeyDown={onRowClick}>
          <RowActions label="Irene Villagers 1" actions={actions} />
        </div>
      </MemoryRouter>
    </ThemeProvider>,
  )
  return onRowClick
}

const edit = (extra: Partial<RowAction> = {}): RowAction => ({
  id: 'edit',
  label: 'Edit',
  icon: <EditOutlinedIcon />,
  ...extra,
})
const remove = (extra: Partial<RowAction> = {}): RowAction => ({
  id: 'remove',
  label: 'Remove',
  icon: <DeleteOutlineIcon />,
  destructive: true,
  ...extra,
})

describe('RowActions on desktop', () => {
  it('renders a named icon button per action and runs the handler', async () => {
    const onEdit = vi.fn()
    renderRow([edit({ onClick: onEdit }), remove()])

    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Irene Villagers 1' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Remove Irene Villagers 1' })).toBeInTheDocument()
  })

  it('shows the action label as a tooltip', async () => {
    renderRow([edit()])

    await userEvent.hover(screen.getByRole('button', { name: 'Edit Irene Villagers 1' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Edit')
  })

  it('sizes the buttons at 36 px and positions them above a stretched row link', () => {
    renderRow([edit()])

    expect(screen.getByRole('button', { name: 'Edit Irene Villagers 1' })).toHaveStyle({
      width: '36px',
      height: '36px',
      position: 'relative',
    })
  })

  it('omits hidden actions and renders nothing when all are hidden', () => {
    renderRow([edit({ hidden: true }), remove()])
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Remove/ })).toBeInTheDocument()
  })

  it('renders nothing when every action is hidden', () => {
    renderRow([edit({ hidden: true })])
    expect(screen.queryByTestId('row-actions')).not.toBeInTheDocument()
  })

  it('disables a disabled action and does not run it', async () => {
    const onEdit = vi.fn()
    renderRow([edit({ disabled: true, onClick: onEdit })])

    const button = screen.getByRole('button', { name: 'Edit Irene Villagers 1' })
    expect(button).toBeDisabled()
    await userEvent.click(button, { pointerEventsCheck: 0 })
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('uses the error colour for a destructive action only', () => {
    renderRow([edit(), remove()])

    const colour = (name: string) => getComputedStyle(screen.getByRole('button', { name })).color
    expect(colour('Remove Irene Villagers 1')).not.toBe(colour('Edit Irene Villagers 1'))
  })

  it('renders a to action as a link', () => {
    renderRow([edit({ to: '/leagues/1/edit' })])

    expect(screen.getByRole('link', { name: 'Edit Irene Villagers 1' })).toHaveAttribute('href', '/leagues/1/edit')
  })

  it('does not let clicks or keys reach the row', async () => {
    const onRow = renderRow([edit({ onClick: vi.fn() })])

    const button = screen.getByRole('button', { name: 'Edit Irene Villagers 1' })
    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(onRow).not.toHaveBeenCalled()
  })

  it('is operable from the keyboard', async () => {
    const onEdit = vi.fn()
    renderRow([edit({ onClick: onEdit })])

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Edit Irene Villagers 1' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})

describe('RowActions on a phone', () => {
  it('renders one three-dot button instead of the icons', () => {
    setPhone(true)
    renderRow([edit(), remove()])

    const trigger = screen.getByRole('button', { name: 'Irene Villagers 1, more actions' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveStyle({ width: '44px', height: '44px' })
    expect(screen.queryByRole('button', { name: 'Edit Irene Villagers 1' })).not.toBeInTheDocument()
  })

  it('opens a menu, runs the chosen action and closes', async () => {
    setPhone(true)
    const onEdit = vi.fn()
    renderRow([edit({ onClick: onEdit }), remove()])

    await userEvent.click(screen.getByRole('button', { name: 'Irene Villagers 1, more actions' }))
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toHaveStyle({ minHeight: '44px' })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('honours hidden and disabled and renders to items as links', async () => {
    setPhone(true)
    renderRow([edit({ to: '/x/edit' }), remove({ disabled: true }), { id: 'gone', label: 'Gone', icon: null, hidden: true }])

    await userEvent.click(screen.getByRole('button', { name: 'Irene Villagers 1, more actions' }))
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('href', '/x/edit')
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('menuitem', { name: 'Gone' })).not.toBeInTheDocument()
  })

  it('opens from the keyboard and closes on Escape without reaching the row', async () => {
    setPhone(true)
    const onRow = renderRow([edit()])

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(onRow).not.toHaveBeenCalled()
  })

  it('does not let the trigger click reach the row', async () => {
    setPhone(true)
    const onRow = renderRow([edit()])

    await userEvent.click(screen.getByRole('button', { name: 'Irene Villagers 1, more actions' }))
    expect(onRow).not.toHaveBeenCalled()
  })
})
