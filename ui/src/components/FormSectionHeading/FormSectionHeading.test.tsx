import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormSectionHeading } from './FormSectionHeading'

describe('FormSectionHeading', () => {
  it('renders the title as a level-2 heading with a hidden icon tile', () => {
    render(<FormSectionHeading icon={<svg data-testid="icon" />} title="Match details" />)

    expect(screen.getByRole('heading', { level: 2, name: 'Match details' })).toBeInTheDocument()
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
