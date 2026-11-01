import { describe, expect, it } from 'vitest'
import { FRAME_ALLOW, FRAME_REFERRER_POLICY, FRAME_SANDBOX, providerName, streamFrame, streamHost } from './streamFrame'

// docs/specs/135 (Watch Live): the frame props never build a URL; they pass the server's embedUrl on, https only, with the fixed sandbox.
describe('streamFrame', () => {
  it('passes the server\'s embed URL through untouched, with the fixed sandbox and policies', () => {
    const embedUrl = 'https://www.youtube-nocookie.com/embed/abc123'
    expect(streamFrame({ embedUrl }, 'A versus B')).toEqual({ src: embedUrl, title: 'A versus B', sandbox: FRAME_SANDBOX, allow: FRAME_ALLOW, referrerPolicy: FRAME_REFERRER_POLICY, loading: 'lazy' })
  })

  it('never allows top navigation or popups', () => {
    expect(FRAME_SANDBOX).toBe('allow-scripts allow-same-origin allow-presentation')
    expect(FRAME_SANDBOX).not.toMatch(/top-navigation|popups/)
  })

  it('gives nothing to embed without an https embed URL', () => {
    expect(streamFrame({ embedUrl: null }, 't')).toBeNull()
    expect(streamFrame({}, 't')).toBeNull()
    expect(streamFrame({ embedUrl: 'http://player.example/x' }, 't')).toBeNull()
    expect(streamFrame({ embedUrl: 'javascript:alert(1)' }, 't')).toBeNull()
  })

  it('names the provider and reads a host only for display', () => {
    expect(providerName('YOUTUBE')).toBe('YouTube')
    expect(providerName('OTHER')).toBe('The stream site')
    expect(streamHost('https://live.example.com/x?y=1')).toBe('live.example.com')
    expect(streamHost('not a url')).toBe('')
  })
})
