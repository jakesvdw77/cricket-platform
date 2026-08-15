import axios from 'axios'
import { keycloak } from '../auth/keycloak'

const api = axios.create({
  baseURL: '/api/v1',
})

api.interceptors.request.use(async (config) => {
  if (keycloak.authenticated) {
    await keycloak.updateToken(30)
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
})

export default api
