import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/specs/147 Test Plan, Guards: source-level rules that keep the card system a contract. Comments are stripped before the copy and
// colour checks so a comment may explain a rule without tripping it.
const SRC = join(import.meta.dirname, '../../../..')
const stats = join(SRC, 'pages/view/myPlayers/stats')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [path] : []
  })
}
const read = (path: string) => readFileSync(path, 'utf8')
const noComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const importsOf = (source: string) => [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])
const rel = (path: string) => path.slice(SRC.length + 1)

const STAT_DIRS = ['pages/view/myPlayers/stats', 'components/StatsCards', 'components/StatsDrawings', 'components/FlipCard']
const ALL = STAT_DIRS.flatMap((dir) => files(join(SRC, dir)))

describe('colour and copy guards', () => {
  it('finds the stats sources (so the guards below are not vacuous)', () => {
    expect(ALL.length).toBeGreaterThan(80)
  })

  it('carries no hex colour literal under stats/, StatsCards, StatsDrawings or FlipCard (colours are tokens)', () => {
    for (const path of ALL) expect(noComments(read(path)), rel(path)).not.toMatch(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![\w-])/)
  })

  it('says "you" and "your" nowhere in the card copy: the player is named by first name', () => {
    for (const path of ALL) expect(noComments(read(path)), rel(path)).not.toMatch(/\byou(r|rs|rself|'re|'ll|'ve)?\b/i)
  })
})

describe('import guards', () => {
  it('has no page importing an individual card file', () => {
    for (const name of ['HubMyStats.tsx', 'HubTeamStats.tsx', 'HubLeaderboards.tsx', 'HubStatsDrill.tsx']) {
      for (const path of importsOf(read(join(stats, name)))) expect(path, `${name} imports ${path}`).not.toMatch(/\/cards\//)
    }
  })

  it('has FlipCard, StatsCardShell and StatsCardGrid import no card and no Hub api module', () => {
    const generic = ['components/FlipCard/FlipCard.tsx', 'components/StatsCards/StatsCardShell.tsx', 'components/StatsCards/StatsCardGrid.tsx', 'components/StatsCards/StatsFaceBoundary.tsx']
    for (const file of generic) {
      for (const path of importsOf(read(join(SRC, file)))) {
        expect(path, `${file} imports ${path}`).not.toMatch(/\/cards\/|statsCardRegistry|pages\/view/)
        expect(path, `${file} imports ${path}`).not.toMatch(/\/api\/(me|myPlayers)/)
      }
    }
  })

  it('has the drawings and the generic components import no page or api module', () => {
    for (const path of [...files(join(SRC, 'components/StatsDrawings')), ...files(join(SRC, 'components/StatsCards'))]) {
      for (const from of importsOf(read(path))) {
        expect(from, `${rel(path)} imports ${from}`).not.toMatch(/\/pages\/|\/api\//)
      }
    }
  })
})

describe('hubStatsNoExport (spec 147 acceptance 14)', () => {
  const banned: [string, RegExp][] = [
    ['a share, export or download import', /from\s+'[^']*(Share|Export|Download|html2canvas|jspdf)[^']*'/i],
    ['the Web Share or clipboard API', /navigator\.(share|clipboard)|canShare\(/],
    ['a download link', /\bdownload=|\bdownload\s*:/],
    ['an object URL or blob', /createObjectURL|new Blob\(/],
    ['a public, export or pdf path', /['"`][^'"`]*\/(export|pdf|public|share)\b[^'"`]*['"`]/i],
  ]

  it.each(banned)('has no %s under stats/', (_name, pattern) => {
    for (const path of files(stats)) expect(noComments(read(path)), rel(path)).not.toMatch(pattern)
  })

  it('has no stats page importing the leaderboard or results share dialogs', () => {
    for (const path of files(stats)) for (const from of importsOf(read(path))) expect(from, rel(path)).not.toMatch(/Share/)
  })
})
