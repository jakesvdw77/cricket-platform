import axios from 'axios'
import { keycloak, keycloakInitPromise } from '../auth/keycloak'

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
    await keycloak.updateToken(30)
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
})

export default api
