import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ACTIVE_BACKDROP_THEME, PageBackdrop } from './PageBackdrop'

describe('PageBackdrop', () => {
  it('renders its children over decorative, aria-hidden art', () => {
    render(<PageBackdrop>Hello</PageBackdrop>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByTestId('page-backdrop').querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
  })

  it('draws the supplied photo behind an overlay', () => {
    render(<PageBackdrop imageUrl="/x.jpg">Hi</PageBackdrop>)
    const art = screen.getByTestId('page-backdrop').querySelectorAll('[data-backdrop-art]')
    expect(art).toHaveLength(2)
  })
})

// Seasonal scenes (docs/specs/121 follow-up): the theme prop picks the scene, and the shipped default is the plain one.
// jsdom cannot compute a data-URI background, so the test reads the rule emotion injected for the art element's class.
describe('PageBackdrop themes', () => {
  const scene = () => screen.getByTestId('page-backdrop').querySelector('[data-backdrop-art]') as HTMLElement
  const rule = (el: HTMLElement) => {
    const cls = Array.from(el.classList).find((name) => name.startsWith('css-')) as string
    const text = Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules).map((r) => r.cssText)).join('\n')
    return text.split('}').find((chunk) => chunk.includes(`.${cls}`)) ?? ''
  }

  it('draws the default scene unless the theme says otherwise, the same as theme="default"', () => {
    const plain = render(<PageBackdrop>Hi</PageBackdrop>)
    const plainRule = rule(scene())
    expect(plainRule).toContain('background-image')
    expect(plainRule).not.toContain('cricket-scene-christmas')
    plain.unmount()

    render(<PageBackdrop theme="default">Hi</PageBackdrop>)
    expect(rule(scene())).toBe(plainRule)
  })

  it('switches to the Christmas scene with theme="christmas", and back with theme="default"', () => {
    const { rerender } = render(<PageBackdrop theme="christmas">Hi</PageBackdrop>)
    expect(rule(scene())).toContain('cricket-scene-christmas.svg')
    const christmasClass = scene().className
    rerender(<PageBackdrop theme="default">Hi</PageBackdrop>)
    expect(rule(scene())).not.toContain('cricket-scene-christmas')
    expect(scene().className).not.toBe(christmasClass)
  })

  it('a supplied photo wins over the theme', () => {
    render(<PageBackdrop theme="christmas" imageUrl="/x.jpg">Hi</PageBackdrop>)
    expect(rule(scene())).toContain('/x.jpg')
    expect(rule(scene())).not.toContain('christmas')
  })

  it('ships with the default theme active (Christmas is ready but switched off)', () => {
    expect(ACTIVE_BACKDROP_THEME).toBe('default')
  })
})
