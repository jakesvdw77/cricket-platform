import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ClubNameSlugFields } from './ClubNameSlugFields'

describe('ClubNameSlugFields', () => {
  it('renders Name and Slug with their current values', () => {
    render(
      <ClubNameSlugFields
        name="Riverside CC"
        slug="riverside-cc"
        slugTouched
        onNameChange={vi.fn()}
        onSlugChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Name')).toHaveValue('Riverside CC')
    expect(screen.getByLabelText('Slug')).toHaveValue('riverside-cc')
  })

  it('calls onNameChange/onSlugChange with the raw string value as the admin types', async () => {
    const user = userEvent.setup()
    const onNameChange = vi.fn()
    const onSlugChange = vi.fn()
    render(
      <ClubNameSlugFields
        name=""
        slug=""
        slugTouched={false}
        onNameChange={onNameChange}
        onSlugChange={onSlugChange}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'A')
    await user.type(screen.getByLabelText('Slug'), 'b')

    expect(onNameChange).toHaveBeenCalledWith('A')
    expect(onSlugChange).toHaveBeenCalledWith('b')
  })

  it('shows the auto-filled hint only while a non-empty slug has not been touched yet', () => {
    const { rerender } = render(
      <ClubNameSlugFields
        name="Riverside CC"
        slug="riverside-cc"
        slugTouched={false}
        onNameChange={vi.fn()}
        onSlugChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Auto-filled from name — edit to override')).toBeInTheDocument()

    rerender(
      <ClubNameSlugFields
        name="Riverside CC"
        slug="riverside-cc"
        slugTouched
        onNameChange={vi.fn()}
        onSlugChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Lowercase letters, numbers, and hyphens, e.g. riverside-cc')).toBeInTheDocument()
  })

  it('renders nameError/slugError over their default helper text when present', () => {
    render(
      <ClubNameSlugFields
        name=""
        slug=""
        slugTouched
        nameError="Name is required"
        slugError="Slug is required"
        onNameChange={vi.fn()}
        onSlugChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Slug is required')).toBeInTheDocument()
  })
})
