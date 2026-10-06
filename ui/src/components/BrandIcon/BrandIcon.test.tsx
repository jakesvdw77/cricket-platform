import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ThemeProvider, alpha } from '@mui/material'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandIcon } from './BrandIcon'
import { baseTheme, withClubBranding } from '../../theme'
import { iconTileBase } from './iconTileBase'
import { BRAND_ICON_NAMES, brandIconUrls, genderAvatarIcon, playerAvatarSrc } from './brandIcons'

describe('BrandIcon', () => {
  it('resolves a source for every registered name', () => {
    for (const name of BRAND_ICON_NAMES) {
      expect(brandIconUrls[name], name).toBeTruthy()
    }
  })

  it('lists exactly the SVG files in src/icons', () => {
    const files = Object.keys(import.meta.glob('../../icons/**/*.svg', { eager: false }))
      .map((path) => path.slice('../../icons/'.length).replace(/\.svg$/, ''))
      .sort()
    expect([...BRAND_ICON_NAMES].sort()).toEqual(files)
    expect(Object.keys(brandIconUrls).sort()).toEqual(files)
  })

  it('applies size to width and height', () => {
    const { container } = render(<BrandIcon name="nav/teams" size={48} />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toHaveStyle({ width: '48px', height: '48px' })
  })

  it('is decorative by default', () => {
    const { container } = render(<BrandIcon name="nav/teams" />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes the supplied alt text', () => {
    const { getByRole } = render(<BrandIcon name="roles/captain" alt="Captain" />)
    const img = getByRole('img', { name: 'Captain' })
    expect(img).not.toHaveAttribute('aria-hidden')
  })
})

describe('genderAvatarIcon', () => {
  it('maps MALE, FEMALE and unknown', () => {
    expect(genderAvatarIcon('MALE')).toBe('people/avatar-male')
    expect(genderAvatarIcon('FEMALE')).toBe('people/avatar-female')
    expect(genderAvatarIcon(null)).toBeNull()
    expect(genderAvatarIcon(undefined)).toBeNull()
  })
})

describe('playerAvatarSrc', () => {
  it('prefers the photo, then the gender icon, then nothing', () => {
    expect(playerAvatarSrc('/p.png', 'MALE')).toBe('/p.png')
    expect(playerAvatarSrc(null, 'FEMALE')).toContain('avatar-female')
    expect(playerAvatarSrc(null, null)).toBeUndefined()
  })
})

describe('BrandIcon tile', () => {
  it('draws a tile of size + 2 x padding (default padding 4) around the image', () => {
    const { getByTestId } = render(<BrandIcon name="nav/teams" size={40} />)
    const tile = getByTestId('brand-icon-tile')
    expect(tile).toHaveStyle({ width: '48px', height: '48px' })
    expect(tile.querySelector('img')).toBeInTheDocument()
  })

  it('honours a custom padding', () => {
    const { getByTestId } = render(<BrandIcon name="nav/teams" size={28} padding={3} />)
    expect(getByTestId('brand-icon-tile')).toHaveStyle({ width: '34px', height: '34px' })
  })

  it('renders the bare image for surface none', () => {
    const { container, queryByTestId } = render(<BrandIcon name="nav/teams" surface="none" size={32} />)
    expect(queryByTestId('brand-icon-tile')).not.toBeInTheDocument()
    expect(container.firstElementChild?.tagName).toBe('IMG')
  })

  it('adds a white ring only when active', () => {
    const { getByTestId, rerender } = render(<BrandIcon name="nav/teams" />)
    expect(getByTestId('brand-icon-tile')).not.toHaveStyle({ boxShadow: '0 0 0 2px #fff' })
    rerender(<BrandIcon name="nav/teams" active />)
    expect(getByTestId('brand-icon-tile')).toHaveStyle({ boxShadow: '0 0 0 2px #fff' })
  })

  it('tints the default club colour at 36 percent of primary.main', () => {
    const { getByTestId } = render(
      <ThemeProvider theme={baseTheme}>
        <BrandIcon name="nav/teams" />
      </ThemeProvider>,
    )
    expect(getByTestId('brand-icon-tile')).toHaveStyle({
      backgroundColor: alpha(baseTheme.palette.primary.main, 0.36),
    })
  })

  it('tints a light club colour from primary.dark', () => {
    const theme = withClubBranding('#e0b53a')
    expect(iconTileBase(theme)).toBe(theme.palette.primary.dark)
    const { getByTestId } = render(
      <ThemeProvider theme={theme}>
        <BrandIcon name="nav/teams" />
      </ThemeProvider>,
    )
    expect(getByTestId('brand-icon-tile')).toHaveStyle({
      backgroundColor: alpha(theme.palette.primary.dark, 0.36),
    })
  })

  it('keeps primary.main for a dark club colour', () => {
    const theme = withClubBranding('#0b2a5b')
    expect(iconTileBase(theme)).toBe(theme.palette.primary.main)
  })
})

describe('icon artwork has no baked-in background', () => {
  const raw = import.meta.glob('../../icons/!(brand)/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<
    string,
    string
  >

  it('contains no background rect or highlight circle', () => {
    expect(Object.keys(raw).length).toBeGreaterThan(30)
    for (const [path, svg] of Object.entries(raw)) {
      expect(svg, path).not.toMatch(/<rect\s+width="256"\s+height="256"\s+fill="#0F5132"/i)
      expect(svg, path).not.toMatch(/<circle\s+cx="200"\s+cy="56"\s+r="70"\s+fill="#14633F"/i)
      const cropped = /\/icons\/(nav|roles|stats|actions)\//.test(path)
      // Two icons draw outside the standard window, so the same 208 window is shifted for them.
      const shifted: Record<string, string> = {
        'nav/squads': '24 48 208 208',
        'actions/announce-team': '24 29 208 208',
      }
      const key = Object.keys(shifted).find((name) => path.endsWith(`/${name}.svg`))
      const expected = key ? shifted[key] : cropped ? '24 24 208 208' : '0 0 256 256'
      expect(svg, path).toContain(`viewBox="${expected}"`)
    }
  })

  it('strip script strips and crops, and is idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'icon-strip-'))
    const sample = (viewBox: string) =>
      `<svg viewBox="${viewBox}">\n  <path d="M0 0"/>\n</svg>\n`
    const withBackground = (viewBox: string) =>
      `<svg viewBox="${viewBox}">\n  <rect width="256" height="256" fill="#0f5132"/>\n  <circle cx="200" cy="56" r="70" fill="#14633F" />\n  <path d="M0 0"/>\n</svg>\n`
    const script = join(process.cwd(), 'scripts/strip-icon-background.mjs')
    const files = {} as Record<string, string>
    for (const group of ['nav', 'people']) {
      mkdirSync(join(dir, group))
      files[group] = join(dir, group, 'sample.svg')
      writeFileSync(files[group], withBackground('0 0 256 256'))
    }
    const run = () => execFileSync('node', [script, dir])
    run()
    expect(readFileSync(files.nav, 'utf8')).toBe(sample('24 24 208 208'))
    expect(readFileSync(files.people, 'utf8')).toBe(sample('0 0 256 256'))
    run()
    expect(readFileSync(files.nav, 'utf8')).toBe(sample('24 24 208 208'))
    expect(readFileSync(files.people, 'utf8')).toBe(sample('0 0 256 256'))
  })
})
