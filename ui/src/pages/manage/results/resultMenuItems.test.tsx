import { describe, expect, it, vi } from 'vitest'
import { resultMenuItems } from './resultMenuItems'

const base = { openTo: '/manage/results/m1', editTo: '/manage/results/m1/capture', onPublish: vi.fn(), onShare: vi.fn() }

describe('resultMenuItems', () => {
  it('a draft: Open Result, Edit Result, Publish Result, Share Result last and disabled with its reason', () => {
    const items = resultMenuItems({ ...base, draft: true })
    expect(items.map((item) => item.title)).toEqual(['Open Result', 'Edit Result', 'Publish Result', 'Share Result'])
    expect(items[1].disabled).toBe(false)
    expect(items[1].to).toBe('/manage/results/m1/capture')
    expect(items[3].disabled).toBe(true)
    expect(items[3].reason).toBeTruthy()
  })

  it('a published result: no Publish Result, Edit Result disabled with its reason, Share Result enabled and last', () => {
    const items = resultMenuItems({ ...base, draft: false })
    expect(items.map((item) => item.title)).toEqual(['Open Result', 'Edit Result', 'Share Result'])
    expect(items[1].disabled).toBe(true)
    expect(items[1].to).toBeUndefined()
    expect(items[1].reason).toBe('Unpublish to edit')
    expect(items[2].disabled).toBe(false)
  })
})
