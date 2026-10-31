import { describe, expect, it } from 'vitest'
import { afterSaveTarget, currentOrigin, safeReturnLabel, safeReturnTo, withReturnTo } from './returnTo'

describe('safeReturnTo', () => {
  it('accepts an in-app /manage/ or /admin/ path with a query', () => {
    expect(safeReturnTo('/manage/fixtures/leagues/l-1/schedule?seasonId=s-1')).toBe('/manage/fixtures/leagues/l-1/schedule?seasonId=s-1')
    expect(safeReturnTo('/admin/clubs')).toBe('/admin/clubs')
  })

  it.each([
    ['an absolute URL', 'https://evil.example/manage/x'],
    ['a protocol-relative address', '//evil.example/manage/x'],
    ['a backslash trick', '/\\evil'],
    ['a backslash inside a manage path', '/manage/\\evil'],
    ['a javascript: address', 'javascript:alert(1)'],
    ['a path outside the allowed areas', '/other'],
    ['the bare area without a path', '/manage'],
    ['a scheme inside the path', '/manage/x?next=https://evil.example'],
    ['a control character', '/manage/fixtures\n/matches'],
    ['a tab character', '/manage/fixtures\t/matches'],
    ['a dot segment', '/manage/../other'],
    ['an encoded slash in the path (double-encoded)', '%2Fmanage%2Ffixtures'],
    ['an encoded backslash in the path', '/manage/fixtures%5Cevil'],
    ['an encoded slash in the path part', '/manage%2F..%2Fother'],
    ['a double-encoded protocol-relative address', '%2F%2Fevil.example'],
    ['an over-long value', `/manage/${'a'.repeat(520)}`],
    ['an empty value', ''],
    ['null', null],
    ['a non-string', 42],
  ])('rejects %s', (_name, value) => {
    expect(safeReturnTo(value)).toBeNull()
  })

  it('accepts exactly 512 characters and rejects 513', () => {
    const base = '/manage/'
    expect(safeReturnTo(base + 'a'.repeat(512 - base.length))).not.toBeNull()
    expect(safeReturnTo(base + 'a'.repeat(513 - base.length))).toBeNull()
  })
})

describe('safeReturnLabel', () => {
  it('accepts plain text and trims it', () => {
    expect(safeReturnLabel('  TVL Division 1 T20 schedule ')).toBe('TVL Division 1 T20 schedule')
  })

  it('rejects blank, over 60 characters, control characters and non-strings', () => {
    expect(safeReturnLabel('   ')).toBeNull()
    expect(safeReturnLabel('x'.repeat(61))).toBeNull()
    expect(safeReturnLabel('x'.repeat(60))).not.toBeNull()
    expect(safeReturnLabel('bad\u0007label')).toBeNull()
    expect(safeReturnLabel(undefined)).toBeNull()
  })

  it('leaves markup as plain text for the caller to render as text', () => {
    expect(safeReturnLabel('<b>x</b>')).toBe('<b>x</b>')
  })
})

describe('withReturnTo', () => {
  it('adds returnTo and returnLabel and round-trips through URLSearchParams', () => {
    const origin = '/manage/fixtures/leagues/l-1/schedule?seasonId=s-1'
    const url = withReturnTo('/manage/fixtures/matches/new?leagueId=l-1&seasonId=s-1', origin, 'TVL Division 1 T20 schedule')
    const [path, query] = url.split('?')
    const params = new URLSearchParams(query)
    expect(path).toBe('/manage/fixtures/matches/new')
    expect(params.get('leagueId')).toBe('l-1')
    expect(params.get('seasonId')).toBe('s-1')
    expect(params.get('returnTo')).toBe(origin)
    expect(params.get('returnLabel')).toBe('TVL Division 1 T20 schedule')
    expect(safeReturnTo(params.get('returnTo'))).toBe(origin)
  })

  it('accepts an { to, label } origin and works on a destination without a query', () => {
    const url = withReturnTo('/manage/teams/1', { to: '/manage/teams', label: 'Teams' })
    expect(new URLSearchParams(url.split('?')[1]).get('returnLabel')).toBe('Teams')
  })

  it('replaces an existing returnTo instead of stacking and keeps the hash', () => {
    const url = withReturnTo('/manage/x?returnTo=%2Fmanage%2Fold&a=1#top', '/manage/new', 'New')
    expect(url.endsWith('#top')).toBe(true)
    const params = new URLSearchParams(url.split('?')[1].split('#')[0])
    expect(params.getAll('returnTo')).toEqual(['/manage/new'])
    expect(params.get('a')).toBe('1')
  })

  it('is stable: the same input gives the same address', () => {
    expect(withReturnTo('/manage/x?a=1', '/manage/y', 'Y')).toBe(withReturnTo('/manage/x?a=1', '/manage/y', 'Y'))
  })

  it('truncates a long label to 60 characters and omits a missing label', () => {
    const long = withReturnTo('/manage/x', '/manage/y', 'L'.repeat(100))
    expect(new URLSearchParams(long.split('?')[1]).get('returnLabel')).toHaveLength(60)
    expect(new URLSearchParams(withReturnTo('/manage/x', '/manage/y').split('?')[1]).has('returnLabel')).toBe(false)
  })

  it('leaves the destination unchanged when the origin is not safe', () => {
    expect(withReturnTo('/manage/x?a=1', 'https://evil.example', 'Evil')).toBe('/manage/x?a=1')
    expect(withReturnTo('/manage/x', '/public/page', 'Public')).toBe('/manage/x')
  })
})

describe('currentOrigin', () => {
  it('is the path and query of the page', () => {
    expect(currentOrigin({ pathname: '/manage/fixtures/leagues/l-1/teams', search: '?seasonId=s-1' })).toBe('/manage/fixtures/leagues/l-1/teams?seasonId=s-1')
    expect(currentOrigin({ pathname: '/manage/fixtures/leagues' })).toBe('/manage/fixtures/leagues')
  })

  it('does not copy its own returnTo and returnLabel forward', () => {
    expect(currentOrigin({ pathname: '/manage/x', search: '?a=1&returnTo=%2Fmanage%2Fy&returnLabel=Y' })).toBe('/manage/x?a=1')
  })
})

describe('afterSaveTarget', () => {
  const schedule = { to: '/manage/fixtures/leagues/l-1/schedule?seasonId=s-1' }

  it('is the default without an origin', () => {
    expect(afterSaveTarget(null, { defaultTo: '/manage/fixtures/matches' })).toBe('/manage/fixtures/matches')
  })

  it('is the origin with one', () => {
    expect(afterSaveTarget(schedule, { defaultTo: '/manage/fixtures/matches' })).toBe(schedule.to)
  })

  it('adds showAll=1 to a league Schedule origin only when asked', () => {
    expect(afterSaveTarget(schedule, { defaultTo: '/x', showAll: true })).toBe('/manage/fixtures/leagues/l-1/schedule?seasonId=s-1&showAll=1')
    expect(afterSaveTarget({ to: '/manage/fixtures/leagues/l-1/teams?seasonId=s-1' }, { defaultTo: '/x', showAll: true })).toBe('/manage/fixtures/leagues/l-1/teams?seasonId=s-1')
    expect(afterSaveTarget({ to: '/manage/fixtures/leagues/l-1/schedule' }, { defaultTo: '/x', showAll: true })).toBe('/manage/fixtures/leagues/l-1/schedule?showAll=1')
  })
})
