import { describe, expect, it } from 'vitest'
import { resultActionFor, resultBadgeFor, resultStateOf } from './matchResultHelpers'

describe('resultStateOf', () => {
  it('maps the server status and treats NONE or missing as none', () => {
    expect(resultStateOf({ resultStatus: 'DRAFT' })).toBe('draft')
    expect(resultStateOf({ resultStatus: 'PUBLISHED' })).toBe('published')
    expect(resultStateOf({ resultStatus: 'NONE' })).toBe('none')
    expect(resultStateOf({})).toBe('none')
  })
})

describe('resultActionFor', () => {
  it('captures when there is no result', () => {
    expect(resultActionFor({ id: 'm1', active: true, resultStatus: 'NONE' })).toEqual({
      caption: 'Capture',
      label: 'Capture result',
      to: '/manage/results/m1/capture',
    })
  })

  it('continues a draft', () => {
    expect(resultActionFor({ id: 'm1', active: true, resultStatus: 'DRAFT' })).toMatchObject({ caption: 'Continue', label: 'Continue result', to: '/manage/results/m1/capture' })
  })

  it('views a published result, even for an inactive match', () => {
    expect(resultActionFor({ id: 'm1', active: false, resultStatus: 'PUBLISHED' })).toMatchObject({ caption: 'Result', label: 'View result', to: '/manage/results/m1' })
  })

  it('offers nothing for an inactive match without a published result', () => {
    expect(resultActionFor({ id: 'm1', active: false, resultStatus: 'NONE' })).toBeNull()
    expect(resultActionFor({ id: 'm1', active: false, resultStatus: 'DRAFT' })).toBeNull()
  })
})

describe('resultBadgeFor', () => {
  it('is amber for a draft, green Completed when published, and absent otherwise', () => {
    expect(resultBadgeFor({ resultStatus: 'DRAFT' })).toEqual({ label: 'Result draft', tone: 'warning' })
    expect(resultBadgeFor({ resultStatus: 'PUBLISHED' })).toEqual({ label: 'Completed', tone: 'active' })
    expect(resultBadgeFor({ resultStatus: 'NONE' })).toBeNull()
    expect(resultBadgeFor({})).toBeNull()
  })
})
