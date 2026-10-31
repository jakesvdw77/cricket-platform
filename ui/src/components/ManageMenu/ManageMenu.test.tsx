import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManageMenu, MANAGE_BUTTON_WIDTH } from './ManageMenu'
import type { ManageMenuGroup } from './ManageMenu'
import { clearViewport, setPhone } from '../../test/accountTestUtils'

function makeGroups(onShare: () => void = vi.fn()): ManageMenuGroup[] {
  return [
    {
      id: 'schedule',
      heading: 'Schedule',
      items: [
        { id: 'add', title: 'Add Match', description: 'Create one fixture.', to: '/there' },
        { id: 'import', title: 'Import Schedule', description: 'Upload a file.', disabled: true, reason: 'Create a season first' },
      ],
    },
    { id: 'league', heading: 'League', items: [{ id: 'share', title: 'Share League', description: 'PDF, poster or message.', onClick: onShare }] },
  ]
}

function renderMenu(groups: ManageMenuGroup[], openFirstGroupId?: string) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<ManageMenu label="Manage League" groups={groups} openFirstGroupId={openFirstGroupId} />} />
        <Route path="/there" element={<p>Arrived</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ManageMenu', () => {
  afterEach(() => clearViewport())

  it('opens a grouped panel with a title and description per option', async () => {
    renderMenu(makeGroups())
    const trigger = screen.getByRole('button', { name: 'Manage League' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Schedule')).toBeInTheDocument()
    expect(within(menu).getByText('League')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Share League/ })).toHaveTextContent('PDF, poster or message.')
  })

  it('lists the chosen group first', async () => {
    renderMenu(makeGroups(), 'league')
    await userEvent.click(screen.getByRole('button', { name: 'Manage League' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual(['manage-item-share', 'manage-item-add', 'manage-item-import'])
  })

  it('shows the reason in place of the description and does not run a disabled item', async () => {
    renderMenu(makeGroups())
    await userEvent.click(screen.getByRole('button', { name: 'Manage League' }))
    const item = screen.getByRole('menuitem', { name: /Import Schedule/ })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveTextContent('Create a season first')
    expect(item).not.toHaveTextContent('Upload a file.')
  })

  it('navigates for a link item', async () => {
    renderMenu(makeGroups())
    await userEvent.click(screen.getByRole('button', { name: 'Manage League' }))
    expect(screen.getByRole('menuitem', { name: /Add Match/ })).toHaveAttribute('href', '/there')
    await userEvent.click(screen.getByRole('menuitem', { name: /Add Match/ }))
    expect(await screen.findByText('Arrived')).toBeInTheDocument()
  })

  it('runs an action item after the panel has closed', async () => {
    const onShare = vi.fn()
    renderMenu(makeGroups(onShare))
    await userEvent.click(screen.getByRole('button', { name: 'Manage League' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Share League/ }))
    await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await vi.waitFor(() => expect(onShare).toHaveBeenCalledTimes(1))
  })

  it('moves between options with the arrow keys', async () => {
    renderMenu(makeGroups())
    screen.getByRole('button', { name: 'Manage League' }).focus()
    await userEvent.keyboard('{Enter}')
    await vi.waitFor(() => expect(screen.getByRole('menuitem', { name: /Add Match/ })).toHaveFocus())
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: /Share League/ })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    renderMenu(makeGroups())
    const trigger = screen.getByRole('button', { name: 'Manage League' })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await vi.waitFor(() => expect(trigger).toHaveFocus())
  })

  it('is a bottom sheet with a full-width 44 px button on a phone', async () => {
    setPhone(true)
    const onShare = vi.fn()
    renderMenu(makeGroups(onShare))
    const trigger = screen.getByRole('button', { name: 'Manage League' })
    await userEvent.click(trigger)
    expect(document.querySelector('.MuiDrawer-paper')).toHaveAttribute('aria-label', 'Manage League')
    await userEvent.click(screen.getByRole('menuitem', { name: /Share League/ }))
    await vi.waitFor(() => expect(onShare).toHaveBeenCalledTimes(1))
  })

  it('renders the filled button by default and a white outlined one with buttonVariant secondary, optionally at the shared fixed width', () => {
    const groups = makeGroups()
    render(
      <MemoryRouter>
        <ManageMenu label="Manage League" groups={groups} testId="filled" />
        <ManageMenu label="Manage Schedule" groups={groups} testId="white" buttonVariant="secondary" fixedWidth />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('filled').className).toContain('MuiButton-contained')
    expect(screen.getByTestId('white').className).toContain('MuiButton-outlined')
    expect(MANAGE_BUTTON_WIDTH).toBe(220)
    expect(getComputedStyle(screen.getByTestId('white')).width).toBe(`${MANAGE_BUTTON_WIDTH}px`)
    expect(getComputedStyle(screen.getByTestId('filled')).width).not.toBe(`${MANAGE_BUTTON_WIDTH}px`)
  })

  describe('kebab trigger with a dense menu', () => {
    const items = [
      { id: 'open', title: 'Open League', description: 'ignored', to: '/there' },
      { id: 'import', title: 'Import Schedule', disabled: true, reason: 'Create a season first' },
      { id: 'share', title: 'Share League', onClick: vi.fn() },
    ]
    function renderKebab(onRowClick: () => void = vi.fn(), onShare: () => void = vi.fn()) {
      const groups: ManageMenuGroup[] = [{ id: 'actions', heading: 'Actions', items: items.map((item) => (item.id === 'share' ? { ...item, onClick: onShare } : item)) }]
      return render(
        <MemoryRouter initialEntries={['/start']}>
          <Routes>
            <Route
              path="/start"
              element={
                <div role="row" onClick={onRowClick} onKeyDown={onRowClick}>
                  <ManageMenu trigger="kebab" dense label="Actions for TVL Division 1 T20" groups={groups} testId="row-kebab" />
                </div>
              }
            />
            <Route path="/there" element={<p>Arrived</p>} />
          </Routes>
        </MemoryRouter>,
      )
    }

    it('is an icon button named for the row, with an Actions tooltip, opening one flat list with no headings or descriptions', async () => {
      renderKebab()
      const trigger = screen.getByRole('button', { name: 'Actions for TVL Division 1 T20' })
      expect(trigger).toHaveTextContent('')
      await userEvent.hover(trigger)
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Actions')
      await userEvent.click(trigger)
      const menu = screen.getByRole('menu')
      expect(within(menu).getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual(['manage-item-open', 'manage-item-import', 'manage-item-share'])
      expect(within(menu).queryByText('ignored')).not.toBeInTheDocument()
      expect(within(menu).queryByText('Actions')).not.toBeInTheDocument()
    })

    it('shows the reason on a disabled item and never runs it', async () => {
      renderKebab()
      await userEvent.click(screen.getByRole('button', { name: 'Actions for TVL Division 1 T20' }))
      const item = screen.getByRole('menuitem', { name: /Import Schedule/ })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).toHaveTextContent('Create a season first')
    })

    it('does not let the row see the button click, the menu click or a key press', async () => {
      const onRowClick = vi.fn()
      const onShare = vi.fn()
      renderKebab(onRowClick, onShare)
      await userEvent.click(screen.getByRole('button', { name: 'Actions for TVL Division 1 T20' }))
      await userEvent.click(screen.getByRole('menuitem', { name: /Share League/ }))
      await vi.waitFor(() => expect(onShare).toHaveBeenCalledTimes(1))
      screen.getByRole('button', { name: 'Actions for TVL Division 1 T20' }).focus()
      await userEvent.keyboard('{Enter}')
      await userEvent.keyboard('{Escape}')
      expect(onRowClick).not.toHaveBeenCalled()
    })

    it('opens from the keyboard, moves with the arrows and returns focus on Escape', async () => {
      renderKebab()
      const trigger = screen.getByRole('button', { name: 'Actions for TVL Division 1 T20' })
      trigger.focus()
      await userEvent.keyboard('{Enter}')
      await vi.waitFor(() => expect(screen.getByRole('menuitem', { name: /Open League/ })).toHaveFocus())
      await userEvent.keyboard('{Escape}')
      await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
      await vi.waitFor(() => expect(trigger).toHaveFocus())
    })

    it('navigates for a link item', async () => {
      renderKebab()
      await userEvent.click(screen.getByRole('button', { name: 'Actions for TVL Division 1 T20' }))
      await userEvent.click(screen.getByRole('menuitem', { name: /Open League/ }))
      expect(await screen.findByText('Arrived')).toBeInTheDocument()
    })

    it('opens as a bottom sheet on a phone', async () => {
      setPhone(true)
      const onShare = vi.fn()
      renderKebab(vi.fn(), onShare)
      await userEvent.click(screen.getByRole('button', { name: 'Actions for TVL Division 1 T20' }))
      expect(document.querySelector('.MuiDrawer-paper')).toHaveAttribute('aria-label', 'Actions for TVL Division 1 T20')
      await userEvent.click(screen.getByRole('menuitem', { name: /Share League/ }))
      await vi.waitFor(() => expect(onShare).toHaveBeenCalledTimes(1))
    })
  })
})
