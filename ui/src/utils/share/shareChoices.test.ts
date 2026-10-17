import { describe, expect, it } from 'vitest'
import { DEFAULT_SHARE_CHOICES, sanitiseShareChoices, shareChoicesKey } from './shareChoices'

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
