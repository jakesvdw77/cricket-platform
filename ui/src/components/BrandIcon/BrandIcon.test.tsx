import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandIcon } from './BrandIcon'
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
