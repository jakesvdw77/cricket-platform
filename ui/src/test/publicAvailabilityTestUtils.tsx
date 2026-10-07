import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { AxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Shared helpers for the public availability page and flow tests (docs/specs/077).

export function problem(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as AxiosResponse)
}

export function renderAt(path: string, routePath: string, element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export async function typeDate(user: UserEvent, day: string, month: string, year: string) {
  await user.type(screen.getByLabelText('Day'), day)
  await user.type(screen.getByLabelText('Month'), month)
  await user.type(screen.getByLabelText('Year'), year)
}

export async function identify(
  user: UserEvent,
  { first, last, day = '4', month = '3', year = '1985' }: { first: string; last: string; day?: string; month?: string; year?: string },
) {
  await user.type(screen.getByLabelText('First name'), first)
  await user.type(screen.getByLabelText('Surname'), last)
  await typeDate(user, day, month, year)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

export function verified(overrides: Record<string, unknown> = {}) {
  return {
    status: 'VERIFIED' as const,
    playerId: 'player-1',
    firstName: 'Liam',
    lastName: 'Carter',
    token: 'tok-1',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  }
}
