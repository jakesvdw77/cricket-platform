import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHARE_CHOICES,
  FACEBOOK_TEMPLATES,
  IMAGE_SIZES,
  IMAGE_TEMPLATES,
  PDF_TEMPLATES,
  sanitiseShareChoices,
  SHARE_FORMATS,
  shareChoicesKey,
  TV_TEMPLATES,
  WHATSAPP_TEMPLATES,
} from './shareChoices'

describe('shareChoices', () => {
  it('keys the choices per club', () => {
    expect(shareChoicesKey('c1')).toBe('share:choices:c1')
  })

  it('returns the defaults for anything that is not an object', () => {
    for (const raw of [null, undefined, 'x', 7, [], true]) expect(sanitiseShareChoices(raw)).toEqual(DEFAULT_SHARE_CHOICES)
  })

  it('round trips valid choices', () => {
    const choices = { ...DEFAULT_SHARE_CHOICES, format: 'IMAGE' as const, teams: 'ours' as const, initialsOnly: true, sponsorIds: ['a', 'b'] }
    expect(sanitiseShareChoices(JSON.parse(JSON.stringify(choices)))).toEqual(choices)
  })

  it('drops invalid values one by one and caps the sponsors at four', () => {
    const result = sanitiseShareChoices({
      format: 'FAX',
      templates: { pdf: 'COMPACT', image: 'nope' },
      teams: 'nobody',
      tvPerformers: 5,
      include: { pdf: { batting: false, bowling: 'yes' } },
      logos: { club: false },
      footerLine: 'no',
      sponsorIds: ['1', '1', '2', 3, '3', '4', '5'],
      initialsOnly: 'maybe',
    })
    expect(result.format).toBeNull()
    expect(result.templates.pdf).toBe('COMPACT')
    expect(result.templates.image).toBe(DEFAULT_SHARE_CHOICES.templates.image)
    expect(result.teams).toBe('both')
    expect(result.tvPerformers).toBe(3)
    expect(result.include.pdf).toEqual({ ...DEFAULT_SHARE_CHOICES.include.pdf, batting: false })
    expect(result.logos).toEqual({ club: false, team: true, league: true })
    expect(result.footerLine).toBe(true)
    expect(result.sponsorIds).toEqual(['1', '2', '3', '4'])
    expect(result.initialsOnly).toBeNull()
  })
})

describe('sanitiseShareChoices in detail', () => {
  it('accepts every valid format, template, size, teams and performers value', () => {
    for (const format of SHARE_FORMATS) expect(sanitiseShareChoices({ format }).format).toBe(format)
    for (const pdf of PDF_TEMPLATES) expect(sanitiseShareChoices({ templates: { pdf } }).templates.pdf).toBe(pdf)
    for (const image of IMAGE_TEMPLATES) expect(sanitiseShareChoices({ templates: { image } }).templates.image).toBe(image)
    for (const tv of TV_TEMPLATES) expect(sanitiseShareChoices({ templates: { tv } }).templates.tv).toBe(tv)
    for (const whatsapp of WHATSAPP_TEMPLATES) expect(sanitiseShareChoices({ templates: { whatsapp } }).templates.whatsapp).toBe(whatsapp)
    for (const facebook of FACEBOOK_TEMPLATES) expect(sanitiseShareChoices({ templates: { facebook } }).templates.facebook).toBe(facebook)
    for (const imageSize of IMAGE_SIZES) expect(sanitiseShareChoices({ imageSize }).imageSize).toBe(imageSize)
    for (const teams of ['both', 'ours']) expect(sanitiseShareChoices({ teams }).teams).toBe(teams)
    for (const tvPerformers of [2, 3]) expect(sanitiseShareChoices({ tvPerformers }).tvPerformers).toBe(tvPerformers)
    for (const initialsOnly of [true, false]) expect(sanitiseShareChoices({ initialsOnly }).initialsOnly).toBe(initialsOnly)
  })

  it('drops a value of the wrong type or from another template family, one key at a time', () => {
    const result = sanitiseShareChoices({
      templates: { pdf: 'NIGHT', image: 'CLUB', tv: 'SHORT', whatsapp: 'REPORT', facebook: 3 },
      imageSize: 'HUGE',
      teams: 1,
      tvPerformers: '2',
      initialsOnly: 'true',
    })
    expect(result.templates).toEqual(DEFAULT_SHARE_CHOICES.templates)
    expect(result.imageSize).toBe('SQUARE')
    expect(result.teams).toBe('both')
    expect(result.tvPerformers).toBe(3)
    expect(result.initialsOnly).toBeNull()
  })

  it('keeps a valid key beside an invalid one', () => {
    const result = sanitiseShareChoices({ templates: { pdf: 'COMPACT', image: 'bad' }, imageSize: 'STORY', teams: 'bad' })
    expect(result.templates.pdf).toBe('COMPACT')
    expect(result.imageSize).toBe('STORY')
    expect(result.templates.image).toBe('CLUB_GREEN')
    expect(result.teams).toBe('both')
  })

  it('fills the missing include and logo switches with the defaults and ignores unknown keys', () => {
    const result = sanitiseShareChoices({ include: { tv: { batters: false, extra: true } }, logos: { league: false, nonsense: true }, mystery: 1 })
    expect(result.include.tv).toEqual({ ...DEFAULT_SHARE_CHOICES.include.tv, batters: false })
    expect(result.include.pdf).toEqual(DEFAULT_SHARE_CHOICES.include.pdf)
    expect(result.logos).toEqual({ club: true, team: true, league: false })
    expect(result).not.toHaveProperty('mystery')
    expect(result.include.tv).not.toHaveProperty('extra')
  })

  it('treats a non-object include, logos or templates as absent', () => {
    expect(sanitiseShareChoices({ include: 'x', logos: [], templates: 4 })).toEqual(DEFAULT_SHARE_CHOICES)
    expect(sanitiseShareChoices({ include: { pdf: 'x', image: null, whatsapp: [] } }).include).toEqual(DEFAULT_SHARE_CHOICES.include)
  })

  it('keeps only non-empty string sponsor ids, unique, at most four, in order', () => {
    expect(sanitiseShareChoices({ sponsorIds: ['b', '', 'a', 'b', null, 7, 'c', 'd', 'e'] }).sponsorIds).toEqual(['b', 'a', 'c', 'd'])
    expect(sanitiseShareChoices({ sponsorIds: 'a' }).sponsorIds).toEqual([])
    expect(sanitiseShareChoices({ sponsorIds: [] }).sponsorIds).toEqual([])
  })

  it('never hands out the shared defaults object, so one caller cannot change them for the next', () => {
    const first = sanitiseShareChoices(null)
    first.include.pdf.batting = false
    first.sponsorIds.push('x')
    expect(sanitiseShareChoices(null).include.pdf.batting).toBe(true)
    expect(DEFAULT_SHARE_CHOICES.include.pdf.batting).toBe(true)
    expect(DEFAULT_SHARE_CHOICES.sponsorIds).toEqual([])
  })

  it('has the documented defaults: Club colours, Club green, Broadcast, Short, Match report, Square, both teams, footer on', () => {
    expect(DEFAULT_SHARE_CHOICES.templates).toEqual({ pdf: 'CLUB', image: 'CLUB_GREEN', tv: 'BROADCAST', whatsapp: 'SHORT', facebook: 'REPORT' })
    expect(DEFAULT_SHARE_CHOICES.imageSize).toBe('SQUARE')
    expect(DEFAULT_SHARE_CHOICES.teams).toBe('both')
    expect(DEFAULT_SHARE_CHOICES.footerLine).toBe(true)
    expect(DEFAULT_SHARE_CHOICES.initialsOnly).toBeNull()
    expect(DEFAULT_SHARE_CHOICES.include.facebook.mentionSponsor).toBe(false)
  })

  it('keeps the key of one club apart from another', () => {
    expect(shareChoicesKey('a')).not.toBe(shareChoicesKey('b'))
  })
})
