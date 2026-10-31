import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MANAGE_BUTTON_WIDTH } from '../../../components/ManageMenu'
import { LeagueTabMenu } from './LeagueTabMenu'

describe('LeagueTabMenu', () => {
  it('shows one white fixed-width Manage button whose panel lists the items in the order given, Share last', async () => {
    const onShare = vi.fn()
    render(
      <MemoryRouter>
        <LeagueTabMenu
          label="Manage Schedule"
          heading="Schedule"
          testId="schedule-menu"
          items={[
            { id: 'add', title: 'Add Match', to: '/add' },
            { id: 'import', title: 'Import Schedule', to: '/import' },
            { id: 'share', title: 'Share Schedule', onClick: onShare },
          ]}
        />
      </MemoryRouter>,
    )
    const button = screen.getByTestId('schedule-menu')
    expect(button).toHaveTextContent('Manage Schedule')
    expect(getComputedStyle(button).width).toBe(`${MANAGE_BUTTON_WIDTH}px`)
    await userEvent.click(button)
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('Schedule')).toBeInTheDocument()
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Add Match'),
      expect.stringContaining('Import Schedule'),
      expect.stringContaining('Share Schedule'),
    ])
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Share Schedule/ }))
    expect(onShare).toHaveBeenCalled()
  })
})
