import { describe, expect, it } from 'vitest'
import { duplicateLeagueNotice } from './duplicateLeagueNotice'

const base = { leagueId: 'l-2', name: 'Division 2', seasonsCopied: 0, playingConditionsCopied: 0, contactsCopied: 0 }

describe('duplicateLeagueNotice', () => {
  it('lists conditions and contacts when both were copied', () => {
    expect(duplicateLeagueNotice({ ...base, seasonsCopied: 1, playingConditionsCopied: 1, contactsCopied: 2 })).toBe(
      'Division 2 created. Playing conditions copied for 1 season, 2 contacts. Add its teams next.',
    )
  })

  it('pluralises seasons and names a single contact', () => {
    expect(duplicateLeagueNotice({ ...base, playingConditionsCopied: 2, contactsCopied: 1 })).toBe(
      'Division 2 created. Playing conditions copied for 2 seasons, 1 contact. Add its teams next.',
    )
  })

  it('names only the conditions or only the contacts when that is all that was copied', () => {
    expect(duplicateLeagueNotice({ ...base, playingConditionsCopied: 1 })).toBe(
      'Division 2 created. Playing conditions copied for 1 season. Add its teams next.',
    )
    expect(duplicateLeagueNotice({ ...base, contactsCopied: 3 })).toBe(
      'Division 2 created. 3 contacts copied. Add its teams next.',
    )
  })

  it('says only that it was created when nothing else was copied', () => {
    expect(duplicateLeagueNotice(base)).toBe('Division 2 created. Add its teams next.')
  })
})
