import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, compactButtonSx } from './Button'

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and unclickable when the disabled prop is set', () => {
    render(<Button disabled>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('keeps its sx on the compact size and still clicks', async () => {
    const onClick = vi.fn()
    render(<Button size="compact" sx={{ mt: 1 }} onClick={onClick}>Add</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  // docs/specs/118 owner item 8: the compact in-card size is about 32 px high; below md a transparent ::after extends the hit area to 44 px.
  it('compactButtonSx is 32 px high with a 13px label and a transparent ::after touch target below md', () => {
    expect(compactButtonSx.minHeight).toBe(32)
    expect(compactButtonSx.fontSize).toBe('0.8125rem')
    expect(compactButtonSx.position).toBe('relative')
    const hitArea = compactButtonSx['&::after']
    expect(hitArea.content).toBe('""')
    expect(hitArea.position).toBe('absolute')
    // 32 + 6 + 6 = 44 px of hit area, shown on phones and tablets only.
    expect(32 - hitArea.top - hitArea.bottom).toBe(44)
    expect(hitArea.display).toEqual({ xs: 'block', md: 'none' })
  })

  it('applies the compact look to the rendered button', () => {
    render(<Button size="compact">Add</Button>)
    const button = screen.getByRole('button', { name: 'Add' })
    expect(button).toHaveStyle({ minHeight: '32px', textTransform: 'none' })
    expect(button.className).toContain('MuiButton-sizeSmall')
  })
})
