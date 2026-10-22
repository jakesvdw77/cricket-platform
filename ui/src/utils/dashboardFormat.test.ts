import { describe, expect, it } from 'vitest'
import { NOT_RECORDED, figureOrNotRecorded, matchTitle, opponentText, percentText, shortDate, sinceCaption, trendSentence, windowCaption } from './dashboardFormat'
import { dismissalLabel } from './dismissalLabel'

// docs/specs/117-stats-dashboard.md: display helpers only. They choose decimals and words for figures the server sent; none computes one.
describe('dashboardFormat', () => {
  it('shortDate writes "6 Mar", and nothing for a missing or unreadable date', () => {
    expect(shortDate('2026-03-06T12:00:00Z')).toBe('6 Mar')
    expect(shortDate(null)).toBe('')
    expect(shortDate('not a date')).toBe('')
  })

  it('opponentText names the opponent, "Internal match" for a derby, a dash when not on file', () => {
    expect(opponentText('Riverside CC', false)).toBe('Riverside CC')
    expect(opponentText(null, true)).toBe('Internal match')
    expect(opponentText('Riverside CC', true)).toBe('Internal match')
    expect(opponentText(null, false)).toBe('–')
  })

  it('matchTitle joins the date and the opponent, in words for a derby', () => {
    expect(matchTitle('2026-03-06T12:00:00Z', 'Riverside CC', false)).toBe('6 Mar v Riverside CC')
    expect(matchTitle('2026-03-06T12:00:00Z', null, true)).toBe('6 Mar internal match')
    expect(matchTitle(null, 'Riverside CC', false)).toBe('v Riverside CC')
    expect(matchTitle('2026-03-06T12:00:00Z', null, false)).toBe('6 Mar')
  })

  it('percentText shows a whole number plainly, otherwise one decimal, and a dash for null', () => {
    expect(percentText(36)).toBe('36%')
    expect(percentText(28.6)).toBe('28.6%')
    expect(percentText(0)).toBe('0%')
    expect(percentText(null)).toBe('–')
    expect(percentText(undefined)).toBe('–')
  })

  it('figureOrNotRecorded formats to the places asked, and null is "Not recorded", never 0', () => {
    expect(figureOrNotRecorded(5.1, 2)).toBe('5.10')
    expect(figureOrNotRecorded(0, 2)).toBe('0.00')
    expect(figureOrNotRecorded(7)).toBe('7')
    expect(figureOrNotRecorded(null, 2)).toBe(NOT_RECORDED)
    expect(figureOrNotRecorded(undefined)).toBe('Not recorded')
  })

  describe('trendSentence', () => {
    it('writes the economy sentence from the three fields the server sent, the direction in words', () => {
      expect(trendSentence({ recent: 5.1, earlier: 6, direction: 'DOWN' }, 'economy')).toBe('Last 5 matches: 5.10 runs per over, down from 6.00 in the 5 before.')
      expect(trendSentence({ recent: 6, earlier: 5.1, direction: 'UP' }, 'economy')).toBe('Last 5 matches: 6.00 runs per over, up from 5.10 in the 5 before.')
      expect(trendSentence({ recent: 5, earlier: 5.1, direction: 'FLAT' }, 'economy')).toBe('Last 5 matches: 5.00 runs per over, level with 5.10 in the 5 before.')
    })

    it('writes the dot-ball sentence with one decimal', () => {
      expect(trendSentence({ recent: 38.2, earlier: 33.9, direction: 'UP' }, 'dots')).toBe('Last 5 matches: 38.2% dot balls, up from 33.9% in the 5 before.')
    })

    it('is null whenever any hint field is missing (the server sends none below three matches per half)', () => {
      expect(trendSentence({ recent: null, earlier: null, direction: null }, 'economy')).toBeNull()
      expect(trendSentence({ recent: 5, earlier: null, direction: 'UP' }, 'economy')).toBeNull()
      expect(trendSentence({ recent: 5, earlier: 6, direction: null }, 'dots')).toBeNull()
      expect(trendSentence({ recent: undefined, earlier: 6, direction: 'UP' }, 'dots')).toBeNull()
    })

    it('treats a recorded 0 as a real figure, not a missing one', () => {
      expect(trendSentence({ recent: 0, earlier: 0, direction: 'FLAT' }, 'dots')).toBe('Last 5 matches: 0.0% dot balls, level with 0.0% in the 5 before.')
    })
  })

  it('windowCaption names the tile that counts everything, and is null when every point is shown', () => {
    expect(windowCaption(30, 52, 'innings', 'Runs')).toBe('Last 30 of 52 innings; the Runs tile counts all 52.')
    expect(windowCaption(30, 30, 'innings', 'Runs')).toBeNull()
    expect(windowCaption(3, 2, 'innings', 'Runs')).toBeNull()
  })

  it('sinceCaption needs both a truncated window and a date', () => {
    expect(sinceCaption(true, '2024-03-03', '3 Mar 2024')).toBe('Since 3 Mar 2024.')
    expect(sinceCaption(false, '2024-03-03', '3 Mar 2024')).toBeNull()
    expect(sinceCaption(true, null, '')).toBeNull()
  })
})

describe('dismissalLabel', () => {
  it('turns a stored type into its words, passes an unknown one through, and a dash for none', () => {
    expect(dismissalLabel('CAUGHT')).toBe('Caught')
    expect(dismissalLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
    expect(dismissalLabel(null)).toBe('–')
  })
})
