import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { KeyFigureTile } from './KeyFigureTile'

describe('KeyFigureTile', () => {
  it('shows the value and the caption', () => {
    render(<KeyFigureTile testId="tile" icon={<span />} value="12" label="Games this season" />)
    expect(screen.getByTestId('tile-value')).toHaveTextContent('12')
    expect(screen.getByText('Games this season')).toBeInTheDocument()
    expect(screen.getByTestId('tile')).toHaveAttribute('data-tone', 'neutral')
  })

  it('marks the warning tone', () => {
    render(<KeyFigureTile testId="tile" icon={<span />} value="Thu 15 Oct" label="Starts 07:15" tone="warning" />)
    expect(screen.getByTestId('tile')).toHaveAttribute('data-tone', 'warning')
  })

  it('is a plain tile, not a button, without onClick', () => {
    render(<KeyFigureTile testId="tile" icon={<span />} value="12" label="Games" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('becomes a labelled picker button when onClick is given', async () => {
    const onClick = vi.fn()
    render(<KeyFigureTile testId="tile" icon={<span />} value="Ann" label="Captain" onClick={onClick} ariaLabel="Captain: Ann, change" />)
    await userEvent.click(screen.getByRole('button', { name: 'Captain: Ann, change' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn()
    render(<KeyFigureTile icon={<span />} value="Ann" label="Captain" onClick={onClick} ariaLabel="Captain" disabled />)
    await userEvent.click(screen.getByRole('button', { name: 'Captain' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  // docs/specs/099-fields-directory.md: the match page's Field tile opens the field.
  describe('to', () => {
    it('becomes a link to the route, without being a button', () => {
      render(
        <MemoryRouter>
          <KeyFigureTile testId="tile" icon={<span />} value="Riverside Oval" label="Field" to="/manage/fixtures/fields/f1" />
        </MemoryRouter>,
      )
      expect(screen.getByTestId('tile')).toHaveAttribute('href', '/manage/fixtures/fields/f1')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('lets onClick win when both are given', async () => {
      const onClick = vi.fn()
      render(
        <MemoryRouter>
          <KeyFigureTile testId="tile" icon={<span />} value="Ann" label="Captain" ariaLabel="Captain" onClick={onClick} to="/elsewhere" />
        </MemoryRouter>,
      )
      expect(screen.getByTestId('tile')).not.toHaveAttribute('href')
      await userEvent.click(screen.getByRole('button', { name: 'Captain' }))
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  it('draws an action under the caption, but not inside a tile that is itself a button', () => {
    const { unmount } = render(<KeyFigureTile icon={<span />} value="None" label="No poll yet" action={<button type="button">Open availability</button>} />)
    expect(screen.getByRole('button', { name: 'Open availability' })).toBeInTheDocument()
    unmount()

    render(<KeyFigureTile icon={<span />} value="Ann" label="Captain" ariaLabel="Captain" onClick={() => {}} action={<button type="button">Nested</button>} />)
    expect(screen.queryByRole('button', { name: 'Nested' })).not.toBeInTheDocument()
  })

  // The statistics pages' compact tile (docs/specs/103, 116).
  describe('compact and emphasis', () => {
    const css = (id: string) => {
      const el = screen.getByTestId(id)
      return getComputedStyle(el)
    }

    it('draws a shorter tile with a smaller icon tile and value than the default', () => {
      const { rerender } = render(<KeyFigureTile testId="tile" icon={<span data-testid="icon" />} value="12" label="Games" />)
      const iconTile = () => screen.getByTestId('icon').parentElement as HTMLElement
      const defaultPadding = css('tile').paddingTop
      const defaultIcon = getComputedStyle(iconTile()).width
      rerender(<KeyFigureTile compact testId="tile" icon={<span data-testid="icon" />} value="12" label="Games" />)
      expect(css('tile').paddingTop).not.toBe(defaultPadding)
      expect(getComputedStyle(iconTile()).width).toBe('32px')
      expect(getComputedStyle(iconTile()).width).not.toBe(defaultIcon)
      expect(css('tile').paddingTop).toBe('10px')
    })

    it('colours the compact value and icon tile by emphasis (primary by default), and leaves a non-compact tile alone', () => {
      const colourOf = (emphasis?: 'primary' | 'success' | 'error') => {
        const { unmount } = render(<KeyFigureTile compact emphasis={emphasis} testId="tile" icon={<span />} value="12" label="Games" />)
        const value = getComputedStyle(screen.getByTestId('tile-value')).color
        const bg = getComputedStyle(screen.getByTestId('tile')).backgroundImage
        unmount()
        return { value, bg }
      }
      const primary = colourOf()
      expect(colourOf('primary')).toEqual(primary)
      const success = colourOf('success')
      const error = colourOf('error')
      expect(success.value).not.toBe(primary.value)
      expect(error.value).not.toBe(primary.value)
      expect(error.value).not.toBe(success.value)
      // no tinted card background, only the coloured value
      expect(success.bg).not.toContain('linear-gradient')
      expect(error.bg).not.toContain('linear-gradient')

      render(<KeyFigureTile emphasis="error" testId="plain" icon={<span />} value="12" label="Games" />)
      expect(getComputedStyle(screen.getByTestId('plain')).backgroundImage).not.toContain('linear-gradient')
      expect(getComputedStyle(screen.getByTestId('plain-value')).color).not.toBe(error.value)
    })
  })
})
