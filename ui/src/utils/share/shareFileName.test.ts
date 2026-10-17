import { describe, expect, it } from 'vitest'
import { shareFileName } from './shareFileName'

const model = (home: string, away: string) =>
  ({
    home: { name: home },
    away: { name: away },
    dateIso: '2026-10-17',
  }) as never

describe('shareFileName', () => {
  it('names the file after the teams and the date', () => {
    expect(shareFileName(model('Riverside 1st XI', 'Coastal CC'), 'png')).toBe('Riverside 1st XI v Coastal CC 2026-10-17.png')
  })

  it('removes characters a file system rejects', () => {
    expect(shareFileName(model('A/B: "C"', 'D*E?'), 'png')).toBe('AB C v DE 2026-10-17.png')
  })
})
