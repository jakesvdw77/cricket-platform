import { describe, expect, it } from 'vitest'
import { DEFAULT_SHARE_CHOICES, mergeShareChoices, sanitiseShareChoices } from './shareChoices'

describe('shareChoices league branch', () => {
  it('defaults to nothing ticked, no format and the standard templates', () => {
    expect(sanitiseShareChoices({}).league).toEqual(DEFAULT_SHARE_CHOICES.league)
    expect(DEFAULT_SHARE_CHOICES.league).toMatchObject({ contents: [], format: null, templates: { pdf: 'CLUB', whatsapp: 'SHORT', facebook: 'FULL_POST' } })
  })

  it('round trips valid league choices', () => {
    const choices = {
      ...DEFAULT_SHARE_CHOICES,
      league: {
        contents: ['SCHEDULE', 'TEAMS'] as never,
        format: 'CALENDAR' as const,
        templates: { pdf: 'COMPACT' as const, whatsapp: 'FULL' as const, facebook: 'BRIEF' as const },
        include: { whatsapp: { emoji: false }, facebook: { hashtags: false }, results: { resultLine: false }, poster: { season: true, dates: false, clubName: true, ourTeamTag: false } },
      },
    }
    // Contents come back in the standard order.
    expect(sanitiseShareChoices(JSON.parse(JSON.stringify(choices))).league).toEqual({ ...choices.league, contents: ['TEAMS', 'SCHEDULE'] })
  })

  it('drops an invalid format, template, content or switch one by one', () => {
    const { league } = sanitiseShareChoices({
      league: { contents: ['TEAMS', 'NOPE', 7], format: 'POSTERISH', templates: { pdf: 'x', whatsapp: 'FULL' }, include: { whatsapp: { emoji: 'no' }, results: { resultLine: false } } },
    })
    expect(league.contents).toEqual(['TEAMS'])
    expect(league.format).toBeNull()
    expect(league.templates).toEqual({ pdf: 'CLUB', whatsapp: 'FULL', facebook: 'FULL_POST' })
    expect(league.include).toEqual({ whatsapp: { emoji: true }, facebook: { hashtags: true }, results: { resultLine: false }, poster: { season: false, dates: true, clubName: false, ourTeamTag: true } })
  })

  it('defaults the poster heading to dates on and season, club name off, with the Our Team tag on', () => {
    expect(DEFAULT_SHARE_CHOICES.league.include.poster).toEqual({ season: false, dates: true, clubName: false, ourTeamTag: true })
    expect(sanitiseShareChoices({ league: { include: { poster: { season: true, dates: 'yes' } } } }).league.include.poster).toEqual({ season: true, dates: true, clubName: false, ourTeamTag: true })
  })

  it('never remembers the contact opt-in, even when storage holds one', () => {
    const stored = { league: { includeContact: true, include: { contact: true, whatsapp: { includeContact: true } } }, includeContact: true }
    const result = JSON.stringify(sanitiseShareChoices(stored))
    expect(result.toLowerCase()).not.toContain('contact')
    expect(JSON.stringify(DEFAULT_SHARE_CHOICES).toLowerCase()).not.toContain('contact')
  })

  it('merges a league change without touching the result choices, and replaces the contents list', () => {
    const merged = mergeShareChoices(DEFAULT_SHARE_CHOICES, { league: { contents: ['KEY_DATES'], include: { results: { resultLine: false } } } })
    expect(merged.league.contents).toEqual(['KEY_DATES'])
    expect(merged.league.include.results.resultLine).toBe(false)
    expect(merged.league.include.whatsapp.emoji).toBe(true)
    expect(merged.templates).toEqual(DEFAULT_SHARE_CHOICES.templates)
  })
})
