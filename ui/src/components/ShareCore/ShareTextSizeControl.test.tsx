import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SHARE_CHOICES } from '../../utils/share/shareChoices'
import { ShareLogoControls } from './ShareLogoControls'
import { ShareTextSizeControl } from './ShareTextSizeControl'

// Every picture template (result and match image and TV, league poster) shows the same Text Size group and the same logo switches.
describe('ShareTextSizeControl', () => {
  it('offers Auto, Large, Larger and Largest, marks the remembered one and saves a pick', async () => {
    const updateChoices = vi.fn()
    render(<ShareTextSizeControl choices={{ ...DEFAULT_SHARE_CHOICES, textSize: 'LARGE' }} updateChoices={updateChoices} />)

    expect(screen.getByText('Text Size')).toBeInTheDocument()
    for (const name of ['Auto', 'Large', 'Larger', 'Largest']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Large' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Largest' }))
    expect(updateChoices).toHaveBeenCalledWith({ textSize: 'LARGEST' })
  })
})

describe('ShareLogoControls: league and affiliation logos', () => {
  const props = { choices: DEFAULT_SHARE_CHOICES, updateChoices: vi.fn(), sponsors: [], selectedSponsorIds: [], clubLogoUrl: '/media/club.png', clubWebsite: null }

  it('always shows the League logo switch, greyed out with its reason when there is no logo', () => {
    render(<ShareLogoControls {...props} leagueLogoUrl={null} />)
    expect(screen.getByRole('checkbox', { name: 'League logo' })).toBeDisabled()
    expect(screen.getByText(/No league logo: this match is not in a league/)).toBeInTheDocument()
  })

  it('shows the affiliation switches only where a team or league can have one, enabled when the logo is set and greyed out when it is not', () => {
    const { unmount } = render(<ShareLogoControls {...props} leagueLogoUrl="/media/l.png" teamAffiliationLogoUrl={null} leagueAffiliationLogoUrl="/media/a.png" />)
    expect(screen.getByRole('checkbox', { name: 'League logo' })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'Team affiliation logo' })).toBeDisabled()
    expect(screen.getByText('No affiliation logo set on the team.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'League affiliation logo' })).toBeEnabled()
    unmount()

    // a league share passes no team affiliation: that switch is not offered at all
    render(<ShareLogoControls {...props} leagueLogoUrl="/media/l.png" />)
    expect(screen.queryByRole('checkbox', { name: 'Team affiliation logo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'League affiliation logo' })).not.toBeInTheDocument()
  })

  it('saves a switch change under logos', async () => {
    const updateChoices = vi.fn()
    render(<ShareLogoControls {...props} updateChoices={updateChoices} leagueLogoUrl={null} teamAffiliationLogoUrl="/media/t.png" />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Team affiliation logo' }))
    expect(updateChoices).toHaveBeenCalledWith({ logos: { teamAffiliation: false } })
  })
})
