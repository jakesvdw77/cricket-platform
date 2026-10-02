import { describe, expect, it } from 'vitest'
import { closePollDescription } from './pollClose'

describe('closePollDescription', () => {
  it('words the reopen window per Autoclose', () => {
    expect(closePollDescription(true)).toMatch(/choosing a new close time/)
    expect(closePollDescription(false)).toMatch(/at any time/)
  })
})
