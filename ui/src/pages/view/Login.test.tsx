import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'

const login = vi.fn()

vi.mock('../../auth/keycloak', () => ({
  keycloak: { login: (...args: unknown[]) => login(...args) },
}))

const renderLogin = (entry = '/login') => render(<MemoryRouter initialEntries={[entry]}><Login /></MemoryRouter>)

describe('Login', () => {
  beforeEach(() => login.mockClear())

  it('redirects straight to Keycloak login on mount, targeting /post-login', () => {
    renderLogin()

    expect(login).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith({ redirectUri: expect.stringContaining('/post-login') })
  })

  it('goes straight to Google with ?idp=google (which also creates an account the first time)', () => {
    renderLogin('/login?idp=google')

    expect(login).toHaveBeenCalledWith({ redirectUri: expect.stringContaining('/post-login'), idpHint: 'google' })
  })

  it('never passes an unknown provider on to Keycloak', () => {
    renderLogin('/login?idp=evil')

    expect(login).toHaveBeenCalledWith({ redirectUri: expect.stringContaining('/post-login') })
  })
})
