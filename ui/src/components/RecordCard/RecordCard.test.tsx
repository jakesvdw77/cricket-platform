import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RecordCard } from './RecordCard'

describe('RecordCard', () => {
  it('renders title, badge, description, fields, and chips in slot order', () => {
    render(
      <RecordCard
        title="Club Standard"
        badge={{ label: 'Active', tone: 'positive' }}
        description="Everything a growing club needs."
        fields={[
          { label: 'Price', value: 'USD 49.99/month' },
          { label: 'Code', value: 'CLUB_STANDARD' },
        ]}
        chips={['5 sections', '10 teams', '200 players']}
        editLabel="Edit"
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Club Standard' })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Everything a growing club needs.')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('USD 49.99/month')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('CLUB_STANDARD')).toBeInTheDocument()
    expect(screen.getByText('5 sections')).toBeInTheDocument()
    expect(screen.getByText('10 teams')).toBeInTheDocument()
    expect(screen.getByText('200 players')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('omits optional slots when not provided', () => {
    render(<RecordCard title="Free" editLabel="Edit" onEdit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Free' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /active|retired|draft/i })).not.toBeInTheDocument()
  })

  it('calls onEdit when the Edit action is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<RecordCard title="Club Standard" editLabel="Edit" onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('renders the muted badge tone distinctly from the neutral tone', () => {
    const { unmount } = render(
      <RecordCard title="Neutral Product" badge={{ label: 'Draft', tone: 'neutral' }} editLabel="Edit" onEdit={vi.fn()} />,
    )
    const neutralChip = screen.getByText('Draft').closest('.MuiChip-root')
    expect(neutralChip).toHaveClass('MuiChip-outlined')
    unmount()

    render(<RecordCard title="Muted Product" badge={{ label: 'Retired', tone: 'muted' }} editLabel="Edit" onEdit={vi.fn()} />)
    const mutedChip = screen.getByText('Retired').closest('.MuiChip-root')
    expect(mutedChip).toHaveClass('MuiChip-filled')
    expect(mutedChip).not.toHaveClass('MuiChip-outlined')
  })

  it('renders the Edit action as a router link when editTo is provided', () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route
            path="/products"
            element={<RecordCard title="Club Standard" editLabel="Edit" editTo="/products/p-1/edit" />}
          />
          <Route path="/products/:id/edit" element={<div>Edit Product Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/products/p-1/edit')
  })
})
