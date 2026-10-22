import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTheme } from '@mui/material/styles'
import { render, renderHook, screen } from '@testing-library/react'
import { bandAxis, labelStride, useReducedMotion, useTooltipContent } from './chartUtils'
import { CATEGORY_STYLES, chartPalette, fillFor, NOT_ITEMISED_STYLE, patternId, safeSvgId } from './chartStyles'
import { ChartTooltipBody } from './ChartTooltipBody'

describe('labelStride', () => {
  it('shows every label up to 8 points, every second to 16, every fourth beyond', () => {
    expect([1, 8].map((count) => labelStride(count))).toEqual([1, 1])
    expect([9, 16].map((count) => labelStride(count))).toEqual([2, 2])
    expect([17, 30].map((count) => labelStride(count))).toEqual([4, 4])
  })

  it('thins a longer two-part label ("4 Oct W") sooner than a bare date', () => {
    expect(labelStride(6, 7)).toBe(2)
    expect(labelStride(5, 7)).toBe(1)
    expect(labelStride(6, 6)).toBe(1)
  })
})

describe('bandAxis', () => {
  it('has one slot per point, formatted from the labels (so two matches on one date stay two bars)', () => {
    const axis = bandAxis(['6 Sep', '6 Sep', '13 Sep'], { axisText: '#000' }) as unknown as {
      data: number[]
      valueFormatter: (index: number) => string
      tickLabelInterval: (value: number, index: number) => boolean
    }
    expect(axis.data).toEqual([0, 1, 2])
    expect(axis.valueFormatter(1)).toBe('6 Sep')
    expect(axis.valueFormatter(9)).toBe('')
    expect(axis.tickLabelInterval(0, 2)).toBe(true)
  })

  it('passes a gap ratio only when defined (an undefined one would break the layout)', () => {
    expect(bandAxis(['a'], { axisText: '#000' })).not.toHaveProperty('categoryGapRatio')
    expect(bandAxis(['a'], { axisText: '#000', categoryGapRatio: 0.25 })).toHaveProperty('categoryGapRatio', 0.25)
  })
})

describe('chart colours and patterns', () => {
  it('uses the theme tokens, and falls back to primary.dark when the club primary is too light for 3:1', () => {
    const light = chartPalette(createTheme({ palette: { primary: { main: '#ffe082', dark: '#8d6e00' } } }))
    expect(light.tones.primary).toBe('#8d6e00')
    const dark = chartPalette(createTheme({ palette: { primary: { main: '#1b5e20' } } }))
    expect(dark.tones.primary).toBe('#1b5e20')
    expect(dark.tones.error).toBe(createTheme().palette.error.main)
  })

  it('gives the categorical styles distinct tone and pattern pairs, and the grey Not itemised one a flat fill', () => {
    const keys = CATEGORY_STYLES.map((style) => `${style.tone}/${style.pattern}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(NOT_ITEMISED_STYLE).toEqual({ tone: 'grey', pattern: 'solid' })
  })

  it('fills solid categories with the tone and the rest with a url(#pattern) reference that has a safe id', () => {
    const palette = chartPalette(createTheme())
    expect(fillFor('scope', 'a', { tone: 'success', pattern: 'solid' }, palette)).toBe(palette.tones.success)
    expect(fillFor(':r1:', 'lost', { tone: 'error', pattern: 'diagonal' }, palette)).toBe('url(#r1-lost)')
    expect(safeSvgId(':r1:-x y')).toBe('r1-xy')
    expect(patternId(':r1:', 'a.b')).toBe('r1-ab')
  })
})

describe('ChartTooltipBody', () => {
  it('shows the title and one row per figure, with a pattern swatch where a style is given', () => {
    render(
      <ChartTooltipBody
        data={{ title: '6 Sep v Riverside', rows: [{ label: 'Wides', value: '4', style: CATEGORY_STYLES[2] }, { label: 'Total', value: '10' }] }}
      />,
    )
    const body = screen.getByTestId('chart-tooltip')
    expect(body).toHaveTextContent('6 Sep v Riverside')
    expect(body).toHaveTextContent('Wides4')
    expect(body).toHaveTextContent('Total10')
    expect(body.querySelectorAll('pattern')).toHaveLength(1)
  })

  it('useTooltipContent hands back one stable component however often the caller\'s function changes', () => {
    const seen: unknown[] = []
    function Probe({ fn }: { fn: (index: number) => { title: string; rows: [] } | null }) {
      seen.push(useTooltipContent(fn))
      return null
    }
    const { rerender } = render(<Probe fn={() => null} />)
    rerender(<Probe fn={() => ({ title: 't', rows: [] })} />)
    expect(seen[0]).toBe(seen[1])
  })
})

describe('useReducedMotion', () => {
  const original = window.matchMedia
  afterEach(() => {
    window.matchMedia = original
  })
  const mockMedia = (reduce: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
  }

  it('is true under prefers-reduced-motion: reduce, so the charts skip their animation', () => {
    mockMedia(true)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true)
  })

  it('is false otherwise', () => {
    mockMedia(false)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false)
  })
})
