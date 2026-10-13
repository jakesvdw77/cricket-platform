import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFieldForm } from './useFieldForm'
import { makeField } from '../test/fieldFixtures'

const getManagedClubProfile = vi.fn()

vi.mock('../api/clubApi', () => ({
  getManagedClubProfile: (clubId: string) => getManagedClubProfile(clubId),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function browser(timeZone: string, language: string) {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions)
  vi.stubGlobal('navigator', { language })
}

beforeEach(() => {
  getManagedClubProfile.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// docs/specs/099-fields-directory.md: Country defaults from the browser time zone, then the locale, then the club's country.
describe('useFieldForm Country default', () => {
  it('starts from the browser time zone without asking the club profile', () => {
    browser('Africa/Johannesburg', 'en-US')
    const { result } = renderHook(() => useFieldForm(null, 'club-1'), { wrapper })

    expect(result.current.values.address.country).toBe('ZA')
    expect(getManagedClubProfile).not.toHaveBeenCalled()
  })

  it('falls back to the locale region when the time zone is unknown', () => {
    browser('UTC', 'en-NZ')
    const { result } = renderHook(() => useFieldForm(null, 'club-1'), { wrapper })

    expect(result.current.values.address.country).toBe('NZ')
    expect(getManagedClubProfile).not.toHaveBeenCalled()
  })

  it('then falls back to the club profile country once it loads', async () => {
    browser('UTC', 'en')
    getManagedClubProfile.mockResolvedValue({ address: { country: 'Australia' } })
    const { result } = renderHook(() => useFieldForm(null, 'club-1'), { wrapper })

    expect(result.current.values.address.country).toBe('')
    await waitFor(() => expect(result.current.values.address.country).toBe('AU'))
  })

  it('does not overwrite a country the manager already chose when the profile arrives late', async () => {
    browser('UTC', 'en')
    let resolve: (value: unknown) => void = () => undefined
    getManagedClubProfile.mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useFieldForm(null, 'club-1'), { wrapper })

    act(() => result.current.update({ address: { ...result.current.values.address, country: 'IN' } }))
    await act(async () => resolve({ address: { country: 'Australia' } }))

    expect(result.current.values.address.country).toBe('IN')
  })

  it('leaves an existing field\'s own country alone', () => {
    browser('Africa/Johannesburg', 'en-ZA')
    const field = makeField({ address: { number: null, street: null, city: 'Leeds', provinceState: null, country: 'GB', postalCode: null } })
    const { result } = renderHook(() => useFieldForm(field, 'club-1'), { wrapper })

    expect(result.current.values.address.country).toBe('GB')
  })

  it('seeds the name typed in the picker', () => {
    browser('Africa/Johannesburg', 'en-ZA')
    const { result } = renderHook(() => useFieldForm(null, 'club-1', { name: 'Hilton Oval' }), { wrapper })
    expect(result.current.values.name).toBe('Hilton Oval')
  })
})

describe('useFieldForm submit', () => {
  it('returns null and exposes the errors while city, country or name are missing', () => {
    browser('UTC', 'en')
    getManagedClubProfile.mockResolvedValue({ address: { country: null } })
    const { result } = renderHook(() => useFieldForm(null, 'club-1'), { wrapper })

    let payload: unknown = 'unset'
    act(() => {
      payload = result.current.submit()
    })

    expect(payload).toBeNull()
    expect(result.current.errors).toMatchObject({ name: 'Name is required', city: 'City is required', country: 'Country is required' })
  })

  it('returns the payload when valid', () => {
    browser('Africa/Johannesburg', 'en-ZA')
    const { result } = renderHook(() => useFieldForm(null, 'club-1'), { wrapper })
    act(() => result.current.update({ name: 'Hilton Oval', ownerName: 'Hilton College', address: { ...result.current.values.address, city: 'Hilton' } }))

    let payload: ReturnType<typeof result.current.submit> = null
    act(() => {
      payload = result.current.submit()
    })

    expect(payload).toMatchObject({ name: 'Hilton Oval', ownerType: 'CLUB', address: { city: 'Hilton', country: 'ZA', street: null } })
  })
})
