import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Register from './Register'

const register = vi.fn()

vi.mock('../../auth/keycloak', () => ({
  keycloak: { register: (...args: unknown[]) => register(...args) },
}))

describe('Register', () => {
  it('sends the visitor straight to the Keycloak registration form, returning to /post-login', () => {
    render(<Register />)

    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith({ redirectUri: expect.stringContaining('/post-login') })
  })
})
