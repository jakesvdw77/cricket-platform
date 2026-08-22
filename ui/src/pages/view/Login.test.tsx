import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Login from './Login'

const login = vi.fn()

vi.mock('../../auth/keycloak', () => ({
  keycloak: { login: (...args: unknown[]) => login(...args) },
}))

describe('Login', () => {
  it('redirects straight to Keycloak login on mount, targeting /post-login', () => {
    render(<Login />)

    expect(login).toHaveBeenCalledTimes(1)
    expect(login).toHaveBeenCalledWith({
      redirectUri: expect.stringContaining('/post-login'),
    })
  })
})
