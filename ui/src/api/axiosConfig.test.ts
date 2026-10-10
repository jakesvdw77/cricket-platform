import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { keycloak } from '../auth/keycloak'
import { navigation, resetSessionExpiryForTests } from '../auth/sessionExpiry'

vi.mock('../auth/keycloak', () => {
  // Simulates the real failure this guards against ("Error while checking login iframe").
  // .catch() here only silences Node/Vitest's unhandled-rejection warning for this reference —
  // it doesn't change the fact that the exported promise itself still rejects when awaited,
  // which is what axiosConfig's own `.catch(() => undefined)` is being tested against below.
  const keycloakInitPromise = Promise.reject(new Error('Error while checking login iframe'))
  keycloakInitPromise.catch(() => undefined)

  return {
    AUTH_AWARE_PATH_PREFIXES: ['/admin', '/manage'],
    keycloak: { authenticated: false, token: 'tok', updateToken: vi.fn(), clearToken: vi.fn() },
    keycloakInitPromise,
  }
})

function setPath(path: string) {
  window.history.pushState({}, '', path)
}

function respondWith(status: number) {
  api.defaults.adapter = async (config) => {
    if (status >= 400) {
      throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, undefined, {
        data: {},
        status,
        statusText: '',
        headers: {},
        config,
      })
    }
    return { data: {}, status, statusText: 'OK', headers: {}, config }
  }
}

describe('axiosConfig', () => {
  const replace = vi.spyOn(navigation, 'replace').mockImplementation(() => undefined)

  beforeEach(() => {
    replace.mockClear()
    vi.mocked(keycloak.clearToken).mockClear()
    vi.mocked(keycloak.updateToken).mockReset()
    keycloak.authenticated = false
    resetSessionExpiryForTests()
    setPath('/')
  })

  it('still sends a request, unauthenticated, when keycloakInitPromise rejects', async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = async (config) => {
      capturedConfig = config
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }

    await expect(api.get('/whatever')).resolves.toMatchObject({ status: 200 })
    expect(capturedConfig?.headers.Authorization).toBeUndefined()
  })

  describe('token refresh failure', () => {
    beforeEach(() => {
      keycloak.authenticated = true
      vi.mocked(keycloak.updateToken).mockRejectedValue(new Error('refresh token expired'))
      respondWith(200)
    })

    it('redirects to the landing page once and rejects the request on /manage', async () => {
      setPath('/manage/teams')

      await expect(api.get('/a')).rejects.toThrow('refresh token expired')
      await expect(api.get('/b')).rejects.toThrow('refresh token expired')

      expect(keycloak.clearToken).toHaveBeenCalledTimes(1)
      expect(replace).toHaveBeenCalledTimes(1)
      expect(replace).toHaveBeenCalledWith('/')
    })

    it('redirects on /admin too', async () => {
      setPath('/admin')

      await expect(api.get('/a')).rejects.toThrow()

      expect(replace).toHaveBeenCalledWith('/')
    })

    it('rejects but does not redirect on a public path', async () => {
      setPath('/clubs/riverside')

      await expect(api.get('/a')).rejects.toThrow('refresh token expired')

      expect(replace).not.toHaveBeenCalled()
    })

    it('does not redirect on /post-login', async () => {
      setPath('/post-login')

      await expect(api.get('/a')).rejects.toThrow()

      expect(replace).not.toHaveBeenCalled()
    })
  })

  describe('401 and 403 responses', () => {
    it('redirects on a 401 on /manage', async () => {
      setPath('/manage')
      respondWith(401)

      await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 401 } })

      expect(replace).toHaveBeenCalledWith('/')
    })

    it('does not redirect on a 401 on the landing page', async () => {
      setPath('/')
      respondWith(401)

      await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 401 } })

      expect(replace).not.toHaveBeenCalled()
    })

    it('does not redirect on a 403 on /manage', async () => {
      setPath('/manage')
      respondWith(403)

      await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 403 } })

      expect(replace).not.toHaveBeenCalled()
    })
  })
})
