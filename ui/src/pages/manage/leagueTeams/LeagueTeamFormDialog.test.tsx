import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LeagueTeamFormDialog } from './LeagueTeamFormDialog'
import { makeLeagueTeam } from './testUtils'

vi.mock('../../../api/mediaApi', () => ({
  uploadMedia: vi.fn(),
  uploadManagedMedia: vi.fn(),
}))

function renderDialog(props: Partial<React.ComponentProps<typeof LeagueTeamFormDialog>> = {}) {
  const onSubmit = vi.fn()
  render(
    <LeagueTeamFormDialog open contextLabel="TVL Division 1 · 2026/27" pending={false} onSubmit={onSubmit} onClose={vi.fn()} {...props} />,
  )
  return onSubmit
}

describe('LeagueTeamFormDialog', () => {
  it('requires a name', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter the team name')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the trimmed name, abbreviation and no logo', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog()
    await user.type(screen.getByLabelText(/Team name/), '  Riverside Occasionals ')
    await user.type(screen.getByLabelText('Abbreviation'), 'RIV')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Riverside Occasionals', abbreviation: 'RIV', logoUrl: null, notes: null }, undefined)
  })

  // docs/specs/151, slice D
  it('saves the trimmed notes, and sends none when the notes are blank', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog()
    await user.type(screen.getByLabelText(/Team name/), 'Riverside Occasionals')
    await user.type(screen.getByLabelText('Notes'), '  Play at the school ground  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Play at the school ground' }), undefined)
  })

  it('prefills the notes of a league team being edited', () => {
    renderDialog({ leagueTeam: makeLeagueTeam({ notes: 'Captain: Sam, 082 555 0100' }) })
    expect(screen.getByLabelText('Notes')).toHaveValue('Captain: Sam, 082 555 0100')
  })

  it('offers Save And Add Another only when adding, and asks the host to stay open', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog()
    await user.type(screen.getByLabelText(/Team name/), 'Police')
    await user.click(screen.getByRole('button', { name: 'Save And Add Another' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Police' }), { another: true })
  })

  it('does not offer Save And Add Another when editing a team', () => {
    renderDialog({ leagueTeam: makeLeagueTeam() })
    expect(screen.queryByRole('button', { name: 'Save And Add Another' })).not.toBeInTheDocument()
  })

  it('does not accept Save And Add Another without a name', async () => {
    const user = userEvent.setup()
    const onSubmit = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Save And Add Another' }))
    expect(await screen.findByText('Enter the team name')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a server duplicate-name error against the Name field', () => {
    renderDialog({ nameError: 'Riverside Occasionals is already registered for this season.' })
    expect(screen.getByText('Riverside Occasionals is already registered for this season.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Team name/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a general save error as a dialog-level alert, not against the Name field', () => {
    renderDialog({ errorMessage: 'Network down' })
    expect(screen.getByRole('alert')).toHaveTextContent('Network down')
    expect(screen.getByLabelText(/Team name/)).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('prefills an edit and says how many matches the change also updates', () => {
    renderDialog({ leagueTeam: makeLeagueTeam({ referencedByMatchCount: 2 }) })
    expect(screen.getByLabelText(/Team name/)).toHaveValue('Centurion Brits CC')
    expect(screen.getByText('Changes also update 2 matches that use this team.')).toBeInTheDocument()
  })

  it('does not mention matches when none use the team', () => {
    renderDialog({ leagueTeam: makeLeagueTeam({ referencedByMatchCount: 0 }) })
    expect(screen.queryByText(/Changes also update/)).not.toBeInTheDocument()
  })
})
