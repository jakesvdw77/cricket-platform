import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { LocationProbe } from './LocationProbe'

// docs/specs/119 UI tests: the account, access and hub screens talk to the real api modules and hooks; a test mocks the one
// axiosConfig module (`vi.mock('.../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))`) and routes by "METHOD url" with routeApi.

type Handler = unknown | ((request: { body?: unknown; config?: { params?: Record<string, unknown> } }) => unknown)

export interface ApiMock {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

export function httpError(status: number, data?: unknown): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data } as never)
}

// Unrouted requests fail with a 404 so a screen under test never hangs on an unexpected call.
export function routeApi(api: ApiMock, routes: Record<string, Handler>) {
  const handle = (method: string, hasBody: boolean) =>
    vi.fn(async (url: string, first?: unknown, second?: unknown) => {
      const key = `${method} ${url}`
      if (!(key in routes)) throw httpError(404)
      const handler = routes[key]
      const request = hasBody ? { body: first, config: second as never } : { config: first as never }
      const data = typeof handler === 'function' ? (handler as (r: typeof request) => unknown)(request) : handler
      if (data instanceof Error) throw data
      return { data }
    })
  api.get.mockImplementation(handle('GET', false))
  api.post.mockImplementation(handle('POST', true))
  api.put.mockImplementation(handle('PUT', true))
  api.delete.mockImplementation(handle('DELETE', false))
}

export const calls = (fn: ReturnType<typeof vi.fn>, url: string) => fn.mock.calls.filter((call) => call[0] === url)

export function setPhone(phone: boolean) {
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

export const clearViewport = () => {
  // jsdom has no matchMedia, so deleting restores the desktop default.
  delete (window as { matchMedia?: unknown }).matchMedia
}

export function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
}

// Renders `routes` (Route elements) at `entry`. Any other path lands on a LocationProbe so navigation can be asserted.
export function renderRoutes(entry: string, routes: ReactNode, client = newQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          {routes}
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// A single element at "/" with a query client and router around it (no route table needed).
export function renderWithProviders(ui: ReactElement, entry = '/') {
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
