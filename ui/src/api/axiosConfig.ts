import axios from 'axios'
import { keycloak, keycloakInitPromise } from '../auth/keycloak'
import { isAuthAwarePath, redirectToLanding } from '../auth/sessionExpiry'

const api = axios.create({
  baseURL: '/api/v1',
})

api.interceptors.request.use(async (config) => {
  // keycloakInitPromise can reject (e.g. "Error while checking login iframe" — a
  // silent-SSO check failure, not a real request error). Swallow it here so an
  // unrelated Keycloak hiccup never blocks an otherwise-unauthenticated request —
  // it just proceeds without a bearer token, same as if the user were logged out.
  await keycloakInitPromise.catch(() => undefined)
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30)
    } catch (error) {
      // The refresh token / SSO session has expired. On /admin and /manage send the user back to
      // the landing page to log in again; always reject so the caller never proceeds with a
      // stale token.
      if (isAuthAwarePath()) redirectToLanding()
      throw error
    }
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
})

// 401 on an auth-aware page means the session is gone. 403 is deliberately not handled: that is a
// real not-authorised case. Public pages (and /post-login) never redirect.
api.interceptors.response.use(undefined, (error) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && isAuthAwarePath()) {
    redirectToLanding()
  }
  return Promise.reject(error)
})

export default api
