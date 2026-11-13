import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/specs/148 Test Plan, Guards: the Club info files are read only and never exported. Comments are stripped before the checks so
// a comment may explain a rule without tripping it. The ONLY `download=` in the feature is the logo Download in HubClubImages.
const SRC = join(import.meta.dirname, '../../../..')
const hub = join(SRC, 'pages/view/myPlayers')

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

// Every non-test file of the feature: the clubInfo folder plus the Hub files that draw Club info.
const FEATURE = [
  ...files(join(hub, 'clubInfo')),
  ...['HubClubInfo.tsx', 'HubClubAbout.tsx', 'HubClubImages.tsx', 'HubClubLinks.tsx'].map((name) => join(hub, name)),
]
const CLUB_INFO_DIR = files(join(hub, 'clubInfo'))

const HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![\w-])/
const YOU = /\byou(r|rs|rself|'re|'ll|'ve)?\b/i
// Visible copy only: text between tags and string literals in JSX attributes/arrays of words are close enough to scan whole files
// once comments are gone, because these files hold no code identifiers called you/your.
const EXPORT_CONTROL = /['">]\s*(Share|Print|Download|Export|Copy All)\b/

const IMPORT_BANS: [string, RegExp][] = [
  ['a share util', /utils\/share/],
  ['jspdf', /jspdf/i],
  ['WhatsAppSendActions', /WhatsAppSendActions/],
  ['a canvas-to-image helper', /html2canvas|canvasToImage|toPng|toBlob|dom-to-image|canvas/i],
]
const USE_BANS: [string, RegExp][] = [
  ['navigator.share', /navigator\.share|canShare\(/],
  ['window.print', /window\.print|\.print\(\)/],
  ['a Blob', /new Blob\(|\bBlob\b/],
  ['an object URL', /createObjectURL/],
  ['an a[download]', /\bdownload\s*[=:]|a\[download\]/],
]

describe('clubInfoNoExport (spec 148)', () => {
  it('finds the feature sources (so the guards below are not vacuous)', () => {
    expect(CLUB_INFO_DIR.map((path) => path.split('/').pop()).sort()).toEqual(['ClubContactRow.tsx', 'HubClubDirectory.tsx', 'clubInfoFormat.ts'])
    expect(FEATURE.length).toBe(7)
  })

  it.each(IMPORT_BANS)('has no clubInfo/ file importing %s', (_name, pattern) => {
    for (const path of CLUB_INFO_DIR) for (const from of importsOf(noComments(read(path)))) expect(from, rel(path)).not.toMatch(pattern)
  })

  it.each(USE_BANS)('has no clubInfo/ file using %s', (_name, pattern) => {
    for (const path of CLUB_INFO_DIR) expect(noComments(read(path)), rel(path)).not.toMatch(pattern)
  })

  it('renders no Share, Print, Download, Export or Copy All control anywhere in the feature, apart from the logo Download', () => {
    for (const path of FEATURE) {
      const source = noComments(read(path)).replace(/['"]Download (logo|banner)['"]/g, '')
      expect(source, rel(path)).not.toMatch(EXPORT_CONTROL)
    }
  })

  it('has the logo Download as the only download= in the whole feature, in HubClubImages', () => {
    const holders = FEATURE.filter((path) => /\bdownload=/.test(noComments(read(path)))).map(rel)
    expect(holders).toEqual(['pages/view/myPlayers/HubClubImages.tsx'])
  })

  it('has the row copy through the shared hook and nothing else touching the clipboard', () => {
    const row = join(hub, 'clubInfo/ClubContactRow.tsx')
    expect(importsOf(read(row))).toContain('../../../../hooks/useCopyToClipboard')
    for (const path of FEATURE) {
      const source = noComments(read(path))
      expect(source, rel(path)).not.toMatch(/navigator\.clipboard|execCommand|utils\/copyToClipboard/)
      if (path !== row) expect(importsOf(source), rel(path)).not.toContain('../../../../hooks/useCopyToClipboard')
    }
  })

  it('carries no hex colour literal (colours are tokens)', () => {
    for (const path of FEATURE) expect(noComments(read(path)), rel(path)).not.toMatch(HEX)
  })

  it('says "you" and "your" nowhere in the visible copy', () => {
    for (const path of FEATURE) expect(noComments(read(path)), rel(path)).not.toMatch(YOU)
  })
})

// The matchers must be able to fail: a seeded offender is caught by each.
describe('the guards are not vacuous', () => {
  it('catches a seeded offender with every matcher', () => {
    expect('import { x } from "../../../../utils/share/pdf"'.match(/utils\/share/)).not.toBeNull()
    expect(importsOf("import jsPDF from 'jspdf'")[0]).toMatch(IMPORT_BANS[1][1])
    expect(importsOf("import { A } from '../WhatsAppSendActions'")[0]).toMatch(IMPORT_BANS[2][1])
    expect(importsOf("import { t } from 'html2canvas'")[0]).toMatch(IMPORT_BANS[3][1])
    for (const [name, sample] of [['navigator.share', 'navigator.share({})'], ['window.print', 'window.print()'], ['a Blob', 'new Blob([x])'], ['an object URL', 'URL.createObjectURL(b)'], ['an a[download]', '<a download="x">']]) {
      const pattern = USE_BANS.find(([label]) => label === name)?.[1] as RegExp
      expect(sample, name).toMatch(pattern)
    }
    for (const sample of ['<Button>Share</Button>', '<Button>Copy All</Button>', "label=\"Export\"", '>Print<', '>Download<']) expect(sample, sample).toMatch(EXPORT_CONTROL)
    expect('const c = "#C9A227"').toMatch(HEX)
    expect('You batted').toMatch(YOU)
    expect('Your club').toMatch(YOU)
  })

  it('strips comments, so a comment naming an offender does not trip a guard', () => {
    const source = noComments('// uses navigator.share and you\nconst a = 1 /* download= */')
    expect(source).not.toMatch(USE_BANS[0][1])
    expect(source).not.toMatch(YOU)
    expect(source).not.toMatch(USE_BANS[4][1])
  })

  it('would flag a seeded second download= outside HubClubImages', () => {
    const seeded = [...FEATURE.map((path) => ({ path: rel(path), source: noComments(read(path)) })), { path: 'pages/view/myPlayers/clubInfo/Seeded.tsx', source: '<a href={u} download="x">' }]
    expect(seeded.filter(({ source }) => /\bdownload=/.test(source)).map(({ path }) => path)).toHaveLength(2)
  })
})
