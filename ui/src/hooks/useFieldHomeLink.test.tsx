import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFieldHomeLink } from './useFieldHomeLink'
import { makeField } from '../test/fieldFixtures'
import { problem } from '../test/publicAvailabilityTestUtils'

const linkPlayingAreaHome = vi.fn()
const unlinkPlayingAreaHome = vi.fn()

vi.mock('../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/playingAreaApi')>()
  return {
    ...actual,
    linkPlayingAreaHome: (clubId: string, id: string) => linkPlayingAreaHome(clubId, id),
    unlinkPlayingAreaHome: (clubId: string, id: string) => unlinkPlayingAreaHome(clubId, id),
  }
})

function Buttons({ clubId }: { clubId: string | undefined }) {
  const { toggleHome, dialog, pendingId } = useFieldHomeLink(clubId)
  return (
    <>
      <button type="button" onClick={() => toggleHome(makeField({ id: 'f-1', linkedHome: false }))}>
        add
      </button>
      <button type="button" onClick={() => toggleHome(makeField({ id: 'f-2', linkedHome: true }))}>
        remove
      </button>
      <span data-testid="pending">{pendingId ?? 'none'}</span>
      {dialog}
    </>
  )
}

function setup(clubId: string | undefined = 'club-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <Buttons clubId={clubId} />
    </QueryClientProvider>,
  )
  return { invalidate }
}

beforeEach(() => {
  vi.clearAllMocks()
  linkPlayingAreaHome.mockResolvedValue(undefined)
  unlinkPlayingAreaHome.mockResolvedValue(undefined)
})

// docs/specs/099-fields-directory.md: the Our fields shortlist.
describe('useFieldHomeLink', () => {
  it('links a field that is not ours and refreshes the playing-areas prefix', async () => {
    const { invalidate } = setup()

    await userEvent.click(screen.getByRole('button', { name: 'add' }))

    await waitFor(() => expect(linkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'f-1'))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'playing-areas'] }))
    expect(unlinkPlayingAreaHome).not.toHaveBeenCalled()
  })

  it('unlinks one of our fields', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'remove' }))

    await waitFor(() => expect(unlinkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'f-2'))
    expect(linkPlayingAreaHome).not.toHaveBeenCalled()
  })

  it('does nothing without a club', async () => {
    setup('')
    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(linkPlayingAreaHome).not.toHaveBeenCalled()
  })

  it('shows the server\'s reason in a notice when it fails', async () => {
    linkPlayingAreaHome.mockRejectedValue(problem(403, { detail: 'Not your club' }))
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'add' }))

    expect(await screen.findByText('Not your club')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: "Couldn't change your fields" })).toBeInTheDocument()
  })
})
