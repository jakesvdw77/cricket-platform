import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePollDescription } from './usePollDescription'

const updateRoundDescription = vi.fn()

vi.mock('../../../api/sectionAvailabilityApi', () => ({
  updateRoundDescription: (clubId: string, roundId: string, description: string) => updateRoundDescription(clubId, roundId, description),
}))

beforeEach(() => {
  vi.clearAllMocks()
  updateRoundDescription.mockResolvedValue({})
})

function Harness({ onSaved }: { onSaved: () => void }) {
  const editor = usePollDescription({ clubId: 'club-1', roundId: 'r1', description: 'Sat 6 Jun fixtures', onSaved })
  return (
    <>
      <button type="button" onClick={editor.openEditor}>
        edit
      </button>
      {editor.dialog}
    </>
  )
}

function renderHarness(onSaved = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <Harness onSaved={onSaved} />
    </QueryClientProvider>,
  )
  return onSaved
}

describe('usePollDescription', () => {
  it('opens the editor with the saved description and saves the new one', async () => {
    const user = userEvent.setup()
    const onSaved = renderHarness()

    await user.click(screen.getByRole('button', { name: 'edit' }))
    const field = await screen.findByRole('textbox')
    expect(field).toHaveValue('Sat 6 Jun fixtures')

    await user.clear(field)
    await user.type(field, 'Sat 6 Jun - U13 Boys')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateRoundDescription).toHaveBeenCalledWith('club-1', 'r1', 'Sat 6 Jun - U13 Boys'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  })

  it('does not save when cancelled', async () => {
    const user = userEvent.setup()
    const onSaved = renderHarness()

    await user.click(screen.getByRole('button', { name: 'edit' }))
    await user.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(updateRoundDescription).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
