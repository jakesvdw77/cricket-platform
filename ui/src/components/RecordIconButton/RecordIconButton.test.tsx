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
})
