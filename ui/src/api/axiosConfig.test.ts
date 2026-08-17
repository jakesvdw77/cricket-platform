import type { InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'

vi.mock('../auth/keycloak', () => {
  // Simulates the real failure this guards against ("Error while checking login iframe").
  // .catch() here only silences Node/Vitest's unhandled-rejection warning for this reference —
  // it doesn't change the fact that the exported promise itself still rejects when awaited,
  // which is what axiosConfig's own `.catch(() => undefined)` is being tested against below.
  const keycloakInitPromise = Promise.reject(new Error('Error while checking login iframe'))
  keycloakInitPromise.catch(() => undefined)

  return {
    keycloak: { authenticated: false, updateToken: vi.fn() },
    keycloakInitPromise,
  }
})

describe('axiosConfig', () => {
  it('still sends a request, unauthenticated, when keycloakInitPromise rejects', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config) => {
      capturedConfig = config
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await expect(api.get('/whatever')).resolves.toMatchObject({ status: 200 })
    expect(capturedConfig?.headers.Authorization).toBeUndefined()
  })
})
