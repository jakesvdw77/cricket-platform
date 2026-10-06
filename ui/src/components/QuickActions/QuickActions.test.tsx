import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuickActions } from './QuickActions'
import type { QuickAction } from './QuickActions'
import { baseTheme } from '../../theme'

function stubViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const min = /min-width:\s*([\d.]+)px/.exec(query)
      const max = /max-width:\s*([\d.]+)px/.exec(query)
      const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true)
      return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }
    }),
  )
}

const actions: QuickAction[] = [
  { id: 'create-match', label: 'Create match', to: '/manage/fixtures/matches/new', icon: 'nav/upcoming-matches' },
  { id: 'add-player', label: 'Add player', to: '/manage/players/new', icon: 'nav/cricket-players' },
]

function renderActions(list: QuickAction[] = actions) {
  return render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter initialEntries={['/manage']}>
        <Routes>
          <Route path="/manage" element={<QuickActions actions={list} />} />
          <Route path="*" element={<div>Navigated</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('QuickActions', () => {
  it('renders nothing when there are no actions', () => {
    stubViewport(1200)
    const { container } = renderActions([])
    expect(container).toBeEmptyDOMElement()
  })

  it('wide: Actions button opens a menu of links and Escape closes it', async () => {
    stubViewport(1200)
    const user = userEvent.setup()
    renderActions()

    const button = screen.getByRole('button', { name: 'Actions' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('speed-dial')).not.toBeInTheDocument()

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Create match' })).toHaveAttribute('href', '/manage/fixtures/matches/new')
    expect(screen.getByRole('menuitem', { name: 'Add player' })).toHaveAttribute('href', '/manage/players/new')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('phone: Fab opens a list that stays open on blur; tapping a label navigates', async () => {
    stubViewport(375)
    const user = userEvent.setup()
    renderActions()

    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument()
    const fab = screen.getByRole('button', { name: 'Quick actions' })
    expect(fab).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Add player' })).not.toBeInTheDocument()

    await user.click(fab)
    expect(fab).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Create match' })).toHaveAttribute('href', '/manage/fixtures/matches/new')
    fireEvent.blur(fab)
    fireEvent.mouseLeave(fab)
    expect(screen.getByRole('link', { name: 'Add player' })).toBeInTheDocument()

    await user.click(screen.getByText('Add player'))
    expect(await screen.findByText('Navigated')).toBeInTheDocument()
  })

  it('phone: backdrop tap, the Fab and Escape each close the list', async () => {
    stubViewport(375)
    const user = userEvent.setup()
    renderActions()
    const fab = screen.getByRole('button', { name: 'Quick actions' })

    await user.click(fab)
    await user.click(screen.getByTestId('quick-actions-backdrop'))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Add player' })).not.toBeInTheDocument())

    await user.click(fab)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Add player' })).not.toBeInTheDocument())

    await user.click(fab)
    await user.click(fab)
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Add player' })).not.toBeInTheDocument())
  })

  it('phone: a single action still shows the Fab', () => {
    stubViewport(375)
    renderActions(actions.slice(0, 1))
    expect(screen.getByRole('button', { name: 'Quick actions' })).toBeInTheDocument()
  })
})
