import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMatchWeather } from './useMatchWeather'

const NOW = new Date(2026, 10, 3, 12, 0)
const forecastBody = {
  daily: {
    time: ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'],
    weather_code: [0, 0, 0, 1, 0, 0, 0],
    temperature_2m_max: [20, 20, 20, 27, 20, 20, 20],
    temperature_2m_min: [10, 10, 10, 14, 10, 10, 10],
    precipitation_probability_max: [0, 0, 0, 20, 0, 0, 0],
  },
}

let fetchMock: ReturnType<typeof vi.fn>
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  fetchMock = vi.fn((url: string) => (url.includes('geocoding') ? json({ results: [{ latitude: -25.9, longitude: 28.2, admin1: 'Gauteng' }] }) : json(forecastBody)))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const mapField = { mapUrl: 'https://www.google.com/maps/@-25.7461,28.1881,17z' }

describe('useMatchWeather', () => {
  it('path 1: coordinates from the map link give a summary without geocoding', async () => {
    const { result } = renderHook(() => useMatchWeather('2026-11-06T09:15:00', mapField, NOW), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.summary?.text).toBe('Mostly sunny, 14 to 27 degrees, 20% rain')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.open-meteo.com')
    expect(String(fetchMock.mock.calls[0][0])).toContain('latitude=-25.75')
  })

  it('path 2: no usable map link geocodes the address city, then asks for the forecast', async () => {
    const field = { mapUrl: 'https://maps.app.goo.gl/x', address: { city: 'Irene', provinceState: 'Gauteng', country: 'ZA' } }
    const { result } = renderHook(() => useMatchWeather('2026-11-06T09:15:00', field, NOW), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls[0]).toContain('geocoding-api.open-meteo.com/v1/search')
    expect(urls[0]).toContain('name=Irene')
    expect(urls[0]).toContain('countryCode=ZA')
    expect(urls[1]).toContain('latitude=-25.90')
  })

  it('path 3: nothing resolves, nothing is shown and no forecast is requested', async () => {
    fetchMock.mockImplementation(() => json({ results: [] }))
    const field = { address: { city: 'Nowhereville', provinceState: null, country: null } }
    const { result } = renderHook(() => useMatchWeather('2026-11-06T09:15:00', field, NOW), { wrapper: wrapper() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.status).toBe('none'))
    expect(result.current.summary).toBeNull()
  })

  it('no map link and no address: no request at all', () => {
    const { result } = renderHook(() => useMatchWeather('2026-11-06T09:15:00', { mapUrl: null, address: null }, NOW), { wrapper: wrapper() })
    expect(result.current.status).toBe('none')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a date beyond the forecast range and a past date make no request', () => {
    const far = renderHook(() => useMatchWeather('2026-11-10T09:15:00', mapField, NOW), { wrapper: wrapper() })
    const past = renderHook(() => useMatchWeather('2026-11-02T09:15:00', mapField, NOW), { wrapper: wrapper() })
    expect(far.result.current.status).toBe('none')
    expect(past.result.current.status).toBe('none')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a failed fetch is quiet', async () => {
    fetchMock.mockImplementation(() => json({}, false))
    const { result } = renderHook(() => useMatchWeather('2026-11-06T09:15:00', mapField, NOW), { wrapper: wrapper() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(result.current.status).toBe('none'))
    expect(result.current.summary).toBeNull()
  })

  it('serves a second call for the same rounded location and date from the cache', async () => {
    const shared = wrapper()
    const first = renderHook(() => useMatchWeather('2026-11-06T09:15:00', mapField, NOW), { wrapper: shared })
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    const second = renderHook(() => useMatchWeather('2026-11-06T14:00:00', { mapUrl: 'https://www.google.com/maps/@-25.7489,28.1899,15z' }, NOW), { wrapper: shared })
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
