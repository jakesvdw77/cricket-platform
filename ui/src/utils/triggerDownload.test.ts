import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerDownload } from './triggerDownload'

// docs/specs/051-league-schedule-sharing.md: this codebase's first forced-download helper — a
// purely mechanical DOM/browser-API sequence (create a temporary <a download>, click it, clean
// up), so this test exercises the real DOM rather than mocking document.createElement.
describe('triggerDownload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates and clicks a real <a> with the right href/download attributes, revokes the object URL, and removes the element from the DOM afterward', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const revokeObjectURLSpy = vi.fn()
    vi.stubGlobal('URL', { ...URL, revokeObjectURL: revokeObjectURLSpy })
    const createElementSpy = vi.spyOn(document, 'createElement')

    triggerDownload('blob:mock-url', 'riverside-1st-xi-schedule.ics')

    const anchor = createElementSpy.mock.results[0]?.value as HTMLAnchorElement
    expect(anchor.tagName).toBe('A')
    expect(anchor.getAttribute('href')).toBe('blob:mock-url')
    expect(anchor.getAttribute('download')).toBe('riverside-1st-xi-schedule.ics')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(document.body.contains(anchor)).toBe(false)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })
})
