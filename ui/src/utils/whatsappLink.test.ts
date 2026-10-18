import { describe, expect, it } from 'vitest'
import { buildWhatsAppLink, buildWhatsAppWebLink, fitsWhatsAppLink, WHATSAPP_LINK_MAX_CHARS } from './whatsappLink'

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

describe('whatsappLink encoding', () => {
  const decode = (link: string, prefix: string): string => decodeURIComponent(link.slice(prefix.length))
  const SAMPLES = [
    '🏏 *Riverside 1 v Pretoria CC*\n🏆 *Riverside 1 won by 24 runs*',
    'Tom & Jerry #1 100% = 50/50 + more ?',
    'Zoë Müller c Émile Öztürk b Thabo Mokoena',
    'Line one\r\nLine two\n\nLine four',
    '⭐ 🇿🇦 👨‍👩‍👧 1️⃣',
    'https://x.test/poll/1?a=b&c=d#frag',
    '',
  ]

  it('builds the wa.me link and the WhatsApp Web link with the same encoded text', () => {
    expect(buildWhatsAppLink('a b')).toBe('https://wa.me/?text=a%20b')
    expect(buildWhatsAppWebLink('a b')).toBe('https://web.whatsapp.com/send?text=a%20b')
  })

  it('encodes emoji, newlines, bold stars, ampersands, hashes and accents so none breaks the query string', () => {
    const link = buildWhatsAppLink('🏏 *Bold*\nA & B #1 é')
    const query = link.slice('https://wa.me/?text='.length)
    expect(query).not.toMatch(/[\s&#]|[^\x20-\x7e]/)
    // The star of WhatsApp bold is a legal query character and stays as it is.
    expect(query).toContain('*Bold*')
    expect(query).toContain('%0A')
    expect(query).toContain('%26')
    expect(query).toContain('%23')
    expect(query).toContain('%F0%9F%8F%8F')
    expect(query).toContain('%C3%A9')
  })

  it('round trips every sample through decodeURIComponent, for both links', () => {
    for (const text of SAMPLES) {
      expect(decode(buildWhatsAppLink(text), 'https://wa.me/?text=')).toBe(text)
      expect(decode(buildWhatsAppWebLink(text), 'https://web.whatsapp.com/send?text=')).toBe(text)
    }
  })

  it('parses back through URL as a single text parameter', () => {
    const text = 'a&b=c #d\n🏏'
    expect(new URL(buildWhatsAppLink(text)).searchParams.get('text')).toBe(text)
    expect(new URL(buildWhatsAppWebLink(text)).searchParams.get('text')).toBe(text)
  })

  it('applies the length guard at exactly the limit of the ENCODED text', () => {
    expect(WHATSAPP_LINK_MAX_CHARS).toBe(1800)
    // One emoji encodes to 12 characters.
    const atLimit = '🏏'.repeat(WHATSAPP_LINK_MAX_CHARS / 12)
    expect(encodeURIComponent(atLimit).length).toBe(WHATSAPP_LINK_MAX_CHARS)
    expect(fitsWhatsAppLink(atLimit)).toBe(true)
    expect(fitsWhatsAppLink(`${atLimit}a`)).toBe(false)
    // A newline is three characters: 600 fit, 601 do not.
    expect(fitsWhatsAppLink('\n'.repeat(600))).toBe(true)
    expect(fitsWhatsAppLink('\n'.repeat(601))).toBe(false)
    expect(fitsWhatsAppLink('')).toBe(true)
  })
})
