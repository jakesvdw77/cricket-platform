import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionGuard, CONNECTION_RETRY_MS } from './ConnectionGuard'
import { reportBackendFailure, resetConnectionStatusForTests } from '../../api/connectionStatus'

const get = vi.hoisted(() => vi.fn())
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return { ...actual, default: { ...actual.default, get } }
})

function renderGuard() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ConnectionGuard>
        <p>The app</p>
      </ConnectionGuard>
    </QueryClientProvider>,
  )
}

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK')
const httpError = (status: number) => new AxiosError('x', 'ERR_BAD_REQUEST', undefined, undefined, { status, data: {}, statusText: '', headers: {}, config: {} as never })

describe('ConnectionGuard', () => {
  beforeEach(() => {
    get.mockReset()
    resetConnectionStatusForTests()
  })
  afterEach(() => vi.useRealTimers())

  it('shows Rain stopped play on a network error and keeps the app mounted', () => {
    renderGuard()
    expect(screen.queryByText('Rain stopped play')).not.toBeInTheDocument()
    act(() => reportBackendFailure(networkError()))
    expect(screen.getByText('Rain stopped play')).toBeInTheDocument()
    expect(screen.getByText('The app')).toBeInTheDocument()
  })

  it('shows it for a 503 but not for an ordinary 400 or 404', () => {
    renderGuard()
    act(() => reportBackendFailure(httpError(400)))
    act(() => reportBackendFailure(httpError(404)))
    expect(screen.queryByText('Rain stopped play')).not.toBeInTheDocument()
    act(() => reportBackendFailure(httpError(503)))
    expect(screen.getByText('Rain stopped play')).toBeInTheDocument()
  })

  it('polls every 10 seconds and disappears when the server answers', async () => {
    vi.useFakeTimers()
    renderGuard()
    act(() => reportBackendFailure(networkError()))
    get.mockRejectedValueOnce(new Error('down'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONNECTION_RETRY_MS)
    })
    expect(get).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Rain stopped play')).toBeInTheDocument()
    get.mockResolvedValueOnce({ status: 404 })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONNECTION_RETRY_MS)
    })
    expect(screen.queryByText('Rain stopped play')).not.toBeInTheDocument()
  })
})
