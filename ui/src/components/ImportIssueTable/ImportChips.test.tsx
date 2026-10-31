import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ImportPendingChip, ImportRowChip } from './ImportChips'

describe('ImportRowChip', () => {
  it('shows an error and a not-ours skip by status, whatever the outcome', () => {
    const { rerender } = render(<ImportRowChip row={{ status: 'ERROR', outcome: 'DUPLICATE' }} />)
    expect(screen.getByText('Error')).toBeInTheDocument()
    rerender(<ImportRowChip row={{ status: 'SKIPPED_NOT_OURS', outcome: 'SKIPPED_NOT_OURS' }} />)
    expect(screen.getByText('Skipped, not ours')).toBeInTheDocument()
  })

  it('shows the outcome words for a duplicate, a difference and a possible duplicate', () => {
    const { rerender } = render(<ImportRowChip row={{ status: 'OK', outcome: 'DUPLICATE' }} />)
    expect(screen.getByText('Already exists')).toBeInTheDocument()
    rerender(<ImportRowChip row={{ status: 'OK', outcome: 'DIFFERS' }} />)
    expect(screen.getByText('Differs')).toBeInTheDocument()
    rerender(<ImportRowChip row={{ status: 'WARNING', outcome: 'POSSIBLE_DUPLICATE' }} />)
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument()
  })

  it('shows the status for a new row or one with no outcome', () => {
    const { rerender } = render(<ImportRowChip row={{ status: 'OK', outcome: 'NEW' }} />)
    expect(screen.getByText('OK')).toBeInTheDocument()
    rerender(<ImportRowChip row={{ status: 'WARNING', outcome: null }} />)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })
})

describe('ImportPendingChip', () => {
  it('shows the given neutral label', () => {
    render(<ImportPendingChip label="Needs a team" />)
    expect(screen.getByText('Needs a team')).toBeInTheDocument()
  })
})
