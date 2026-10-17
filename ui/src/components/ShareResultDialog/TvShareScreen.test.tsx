import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeScreenProps, mockCanvas, renderScreen, updateChoices } from './shareScreenTestUtils'
import { TvShareScreen } from './TvShareScreen'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanvas()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TvShareScreen', () => {
  it('shows the match summary preview with its label and the TV controls, and no Teams or size control', () => {
    renderScreen(<TvShareScreen {...makeScreenProps()} />)

    expect(screen.getByRole('img', { name: 'Match summary: Riverside 1 won by 24 runs' })).toBeInTheDocument()
    for (const name of ['Broadcast', 'Club colour', 'Light', 'Top 2', 'Top 3']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    for (const name of ['Initials only', 'Batters', 'Bowlers', 'Player of the match bar', 'Club logo', 'Team logos', 'Footer line']) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText('Teams')).not.toBeInTheDocument()
    expect(screen.queryByText('Size')).not.toBeInTheDocument()
    expect(screen.getByText(/1920 x 1080/)).toBeInTheDocument()
  })

  it('remembers the template, the performers count and the switches', async () => {
    renderScreen(<TvShareScreen {...makeScreenProps()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(updateChoices).toHaveBeenLastCalledWith({ templates: expect.objectContaining({ tv: 'LIGHT' }) })
    await userEvent.click(screen.getByRole('button', { name: 'Top 2' }))
    expect(updateChoices).toHaveBeenLastCalledWith({ tvPerformers: 2 })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Bowlers' }))
    expect(updateChoices).toHaveBeenLastCalledWith({
      include: expect.objectContaining({ tv: expect.objectContaining({ bowlers: false }) }),
    })
  })

  it('offers Download PNG where files cannot be shared', async () => {
    renderScreen(<TvShareScreen {...makeScreenProps()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled())
  })
})
