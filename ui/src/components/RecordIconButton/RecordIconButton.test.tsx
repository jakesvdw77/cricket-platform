import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecordIconButton } from './RecordIconButton'

describe('RecordIconButton', () => {
  it('renders the initials fallback and the accessible label', () => {
    render(<RecordIconButton shape="circular" label="Jane Smith — Manager" name="Jane Smith" initials="JS" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Jane Smith — Manager' })).toBeInTheDocument()
    expect(screen.getByText('JS')).toBeInTheDocument()
  })

  it('renders the name as a visible caption under the avatar', () => {
    render(<RecordIconButton shape="circular" label="Jane Smith — Manager" name="Jane Smith" initials="JS" onClick={vi.fn()} />)

    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RecordIconButton shape="rounded" label="Acme Bank — Sponsor" name="Acme Bank" initials="AC" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Acme Bank — Sponsor' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('compact renders only a 32px avatar with no caption but keeps the accessible name', () => {
    render(
      <RecordIconButton compact shape="circular" label="Jane Smith — Manager" name="Jane Smith" initials="JS" onClick={vi.fn()} />,
    )

    const button = screen.getByRole('button', { name: 'Jane Smith — Manager' })
    expect(button).toHaveAttribute('title', 'Jane Smith — Manager')
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    const avatar = screen.getByText('JS').closest('.MuiAvatar-root') as HTMLElement
    expect(getComputedStyle(avatar).width).toBe('32px')
    expect(getComputedStyle(avatar).height).toBe('32px')
  })

  it('compact still calls onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RecordIconButton compact shape="circular" label="Jane" name="Jane" initials="J" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Jane' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('default (non-compact) is 44px with the caption', () => {
    render(<RecordIconButton shape="circular" label="Jane" name="Jane" initials="J" onClick={vi.fn()} />)

    const avatar = screen.getByText('J').closest('.MuiAvatar-root') as HTMLElement
    expect(getComputedStyle(avatar).width).toBe('44px')
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })
})
