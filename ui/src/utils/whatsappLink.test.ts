import { describe, expect, it } from 'vitest'
import { buildWhatsAppLink, fitsWhatsAppLink, WHATSAPP_LINK_MAX_CHARS } from './whatsappLink'

describe('whatsappLink', () => {
  it('encodes the whole message, links and line breaks included', () => {
    const text = '*Hi* there\nhttps://x.test/poll/1?a=b&c=d'
    expect(buildWhatsAppLink(text)).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`)
  })

  it('guards on the encoded length, not the raw length', () => {
    expect(fitsWhatsAppLink('a'.repeat(WHATSAPP_LINK_MAX_CHARS))).toBe(true)
    expect(fitsWhatsAppLink('a'.repeat(WHATSAPP_LINK_MAX_CHARS + 1))).toBe(false)
    // A space encodes to three characters, so 700 spaces overflow although the raw text is short.
    expect(fitsWhatsAppLink(' '.repeat(700))).toBe(false)
  })
})
