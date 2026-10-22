import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// docs/specs/117-stats-dashboard.md ("Structural"): only components/charts/** may import @mui/x-charts. dependency-cruiser is not
// installed, so the rule is an oxlint no-restricted-imports override; this test pins the config and scans the sources so a break
// is caught even if the lint config drifts.
const SRC = join(process.cwd(), 'src')
const ALLOWED = join('components', 'charts') + sep

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('@mui/x-charts import restriction', () => {
  it('is restricted everywhere by the oxlint config and lifted only for components/charts', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), '.oxlintrc.json'), 'utf8'))
    const [severity, options] = config.rules['no-restricted-imports']
    expect(severity).toBe('error')
    expect(JSON.stringify(options)).toContain('@mui/x-charts')
    expect(config.overrides).toEqual([{ files: ['src/components/charts/**'], rules: { 'no-restricted-imports': 'off' } }])
  })

  it('is imported by no file outside components/charts', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !relative(SRC, file).startsWith(ALLOWED))
      .filter((file) => !file.endsWith('importRestriction.test.ts'))
      .filter((file) => /from\s+['"]@mui\/x-charts(\/[^'"]*)?['"]|import\(\s*['"]@mui\/x-charts/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it('is imported by at least one chart wrapper (the scan is not vacuous)', () => {
    const importers = sourceFiles(join(SRC, 'components', 'charts')).filter((file) => readFileSync(file, 'utf8').includes("from '@mui/x-charts'"))
    expect(importers.length).toBeGreaterThan(0)
  })
})
