import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecordIconButton } from './RecordIconButton'

describe('RecordIconButton', () => {
  it('renders the initials fallback and the accessible label', () => {
    render(<RecordIconButton shape="circular" label="Jane Smith — Manager" initials="JS" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Jane Smith — Manager' })).toBeInTheDocument()
    expect(screen.getByText('JS')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<RecordIconButton shape="rounded" label="Acme Bank — Sponsor" initials="AC" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Acme Bank — Sponsor' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
