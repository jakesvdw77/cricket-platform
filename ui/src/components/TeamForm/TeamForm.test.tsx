import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TeamForm, TEAM_FORM_ID } from './TeamForm'
import type { TeamFormProps } from './TeamForm'
import type { TeamFormValues } from './TeamForm'
import type { Section } from '../../api/sectionApi'

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Section',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// TeamForm's own submit button lives outside it (RecordFormScreen's actions bar, see
// TeamFormPage) and targets the form via the native `form="…"` attribute — this mirrors that
// wiring so the form's submit behaviour can still be exercised in isolation, same pattern as
// ClubContactForm.test.tsx.
function renderTeamForm(props: TeamFormProps, submitLabel = 'Submit') {
  return render(
    <>
      <TeamForm {...props} />
      <button type="submit" form={TEAM_FORM_ID}>
        {submitLabel}
      </button>
    </>,
  )
}

const SECTIONS: Section[] = [
  makeSection({ id: 'section-1', name: 'Men' }),
  makeSection({ id: 'section-2', name: 'Women' }),
]

describe('TeamForm', () => {
  it('does not render a section picker when the sections prop is omitted', () => {
    renderTeamForm({ onSubmit: vi.fn() })

    expect(screen.queryByLabelText('Section')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('renders a required section picker when the sections prop is supplied', () => {
    renderTeamForm({ onSubmit: vi.fn(), sections: SECTIONS })

    expect(screen.getByLabelText('Section')).toBeInTheDocument()
  })

  it('renders an inline validation error for a blank name and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderTeamForm({ onSubmit })

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits {name, logoUrl: null} with no sectionId when the sections prop is omitted and no logo was uploaded', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderTeamForm({ onSubmit })

    await user.type(screen.getByLabelText('Name'), '1st XI')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as TeamFormValues
    expect(payload).toEqual({ name: '1st XI', logoUrl: null })
  })

  it('requires a section to be chosen when the sections prop is supplied, and does not submit without one', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderTeamForm({ onSubmit, sections: SECTIONS })

    await user.type(screen.getByLabelText('Name'), '1st XI')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Section is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits {name, sectionId} once a section is chosen', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderTeamForm({ onSubmit, sections: SECTIONS })

    // The Section field opens a real SectionTree in a popover (not a flat Select) — picking a
    // node's label closes it and fills the field. See SectionTreeSelect.test.tsx for coverage of
    // the picker itself; this just confirms TeamForm wires it correctly end to end.
    await user.click(screen.getByLabelText('Section'))
    await user.click(await screen.findByText('Women'))
    await user.type(screen.getByLabelText('Name'), '2nd XI')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0][0] as TeamFormValues
    expect(payload).toEqual({ name: '2nd XI', sectionId: 'section-2', logoUrl: null })
  })

  it('prefills from initialValues', () => {
    renderTeamForm({
      onSubmit: vi.fn(),
      initialValues: { name: 'Existing Team' },
    })

    expect(screen.getByLabelText('Name')).toHaveValue('Existing Team')
  })

  describe('logo field', () => {
    it('renders the logo upload control in both create and edit modes', () => {
      renderTeamForm({ onSubmit: vi.fn() })
      expect(screen.getByText('Logo')).toBeInTheDocument()

      renderTeamForm({ onSubmit: vi.fn(), initialValues: { name: 'Existing Team', logoUrl: 'https://cdn.example.com/team.png' } })
      expect(screen.getAllByText('Logo').length).toBeGreaterThan(0)
    })

    it('shows the club-logo fallback caption when the team has no logo of its own and clubLogoUrl is supplied', () => {
      renderTeamForm({ onSubmit: vi.fn(), clubLogoUrl: 'https://cdn.example.com/club.png' })

      expect(screen.getByText(/using your club's logo/i)).toBeInTheDocument()
    })

    it('does not show the fallback caption when the team already has its own logo', () => {
      renderTeamForm({
        onSubmit: vi.fn(),
        initialValues: { name: 'Existing Team', logoUrl: 'https://cdn.example.com/team.png' },
        clubLogoUrl: 'https://cdn.example.com/club.png',
      })

      expect(screen.queryByText(/using your club's logo/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reset to club logo' })).toBeInTheDocument()
    })

    it('does not show the fallback caption or reset action when neither a team nor a club logo exists', () => {
      renderTeamForm({ onSubmit: vi.fn() })

      expect(screen.queryByText(/using your club's logo/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset to club logo' })).not.toBeInTheDocument()
    })

    it('"Reset to club logo" clears an existing override back to null', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      renderTeamForm({
        onSubmit,
        initialValues: { name: 'Existing Team', logoUrl: 'https://cdn.example.com/team.png' },
        clubLogoUrl: 'https://cdn.example.com/club.png',
      })

      await user.click(screen.getByRole('button', { name: 'Reset to club logo' }))

      expect(screen.getByText(/using your club's logo/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset to club logo' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Submit' }))

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: null }))
    })
  })
})
