import { describe, expect, it } from 'vitest'
import { backTarget } from './backTarget'

const FALLBACK = { to: '/manage/results', label: 'Results' }

describe('backTarget', () => {
  it('follows an in-app /manage/ address with its label', () => {
    expect(backTarget({ backTo: '/manage/teams/t1?x=1', backLabel: ' Team ' }, FALLBACK)).toEqual({ to: '/manage/teams/t1?x=1', label: 'Team' })
  })

  it('falls back to "previous page" for a missing or blank label', () => {
    expect(backTarget({ backTo: '/manage/teams/t1' }, FALLBACK).label).toBe('previous page')
    expect(backTarget({ backTo: '/manage/teams/t1', backLabel: '  ' }, FALLBACK).label).toBe('previous page')
  })

  it('returns the fallback for anything else', () => {
    const bad = [
      null,
      undefined,
      'text',
      {},
      { backTo: 42 },
      { backTo: 'https://evil.example/manage/x' },
      { backTo: '//evil.example' },
      { backTo: '//manage/x' },
      { backTo: '/elsewhere' },
      { backTo: 'manage/x' },
      { backTo: '/manage/\\evil' },
    ]
    for (const state of bad) expect(backTarget(state, FALLBACK)).toBe(FALLBACK)
  })
})
