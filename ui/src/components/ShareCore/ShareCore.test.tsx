import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as Core from './index'
import { resolveShareInitials, ShareControlGroup, ShareInitialsControl, ShareSponsorChooser, useEditableShareText, useShareLogoImages } from './index'
import { DEFAULT_SHARE_CHOICES } from '../../utils/share/shareChoices'
import * as OldControlGroup from '../ShareResultDialog/ShareControlGroup'
import * as OldImageActions from '../ShareResultDialog/ShareImageActions'
import * as OldInitials from '../ShareResultDialog/ShareInitialsControl'
import * as OldLogos from '../ShareResultDialog/ShareLogoControls'
import * as OldPdfActions from '../ShareResultDialog/SharePdfActions'
import * as OldSponsors from '../ShareResultDialog/ShareSponsorChooser'
import * as OldText from '../ShareResultDialog/useEditableShareText'
import * as OldInitialsHook from '../ShareResultDialog/useShareInitials'
import * as OldLogoImages from '../ShareResultDialog/useShareLogoImages'

// docs/specs/122-league-sharing.md (ShareCore): the pieces both share dialogs use live here; the old
// ShareResultDialog paths re-export the SAME values, so existing imports keep working.
describe('ShareCore re-exports', () => {
  it('exposes every shared piece', () => {
    for (const name of ['ShareControlGroup', 'ShareImageActions', 'ShareInitialsControl', 'ShareLogoControls', 'SharePdfActions', 'ShareSponsorChooser', 'useEditableShareText', 'useShareLogoImages', 'resolveShareInitials']) {
      expect(Core[name as keyof typeof Core], name).toBeTypeOf('function')
    }
  })

  it('is the very same implementation behind the old ShareResultDialog paths', () => {
    expect(OldControlGroup.ShareControlGroup).toBe(Core.ShareControlGroup)
    expect(OldImageActions.ShareImageActions).toBe(Core.ShareImageActions)
    expect(OldInitials.ShareInitialsControl).toBe(Core.ShareInitialsControl)
    expect(OldLogos.ShareLogoControls).toBe(Core.ShareLogoControls)
    expect(OldPdfActions.SharePdfActions).toBe(Core.SharePdfActions)
    expect(OldSponsors.ShareSponsorChooser).toBe(ShareSponsorChooser)
    expect(OldText.useEditableShareText).toBe(useEditableShareText)
    expect(OldLogoImages.useShareLogoImages).toBe(useShareLogoImages)
    expect(OldInitialsHook.resolveShareInitials).toBe(resolveShareInitials)
  })
})

describe('ShareControlGroup', () => {
  it('labels a section of controls', () => {
    render(
      <ShareControlGroup label="Include">
        <span>child</span>
      </ShareControlGroup>,
    )
    expect(screen.getByRole('region', { name: 'Include' })).toHaveTextContent('child')
  })
})

describe('resolveShareInitials and ShareInitialsControl', () => {
  const input = { choices: DEFAULT_SHARE_CHOICES, updateChoices: vi.fn(), settings: undefined, setClubDefault: vi.fn(), clubDefaultSaving: false, clubDefaultFailed: false }

  it('locks the switch on with the visible reason for a junior share, whatever was remembered', async () => {
    const updateChoices = vi.fn()
    const initials = resolveShareInitials({ ...input, updateChoices, choices: { ...DEFAULT_SHARE_CHOICES, initialsOnly: false }, junior: { junior: true, reason: 'LEAGUE_MAX_AGE' } })
    render(<ShareInitialsControl initials={initials} collisions={[]} onChange={initials.setValue} />)

    expect(initials.value).toBe(true)
    const toggle = screen.getByRole('checkbox', { name: 'First names as initials' })
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(screen.getByText('Always on for junior leagues')).toBeInTheDocument()
    initials.setValue(false)
    expect(updateChoices).not.toHaveBeenCalled()
  })

  it('follows the club default until the user chooses, and an unreadable league fails safe', async () => {
    const adult = { junior: false, reason: null }
    expect(resolveShareInitials({ ...input, junior: adult, settings: { initialsOnlyDefault: true, disabledFormats: {} } }).value).toBe(true)
    expect(resolveShareInitials({ ...input, junior: adult, choices: { ...DEFAULT_SHARE_CHOICES, initialsOnly: false }, settings: { initialsOnlyDefault: true, disabledFormats: {} } }).value).toBe(false)
    expect(resolveShareInitials({ ...input, junior: { junior: true, reason: 'UNAVAILABLE' } }).lockReason).toMatch(/Could not check the league/)
  })

  it('passes the new value on when the user changes an unlocked switch', async () => {
    const onChange = vi.fn()
    const initials = resolveShareInitials({ ...input, junior: { junior: false, reason: null } })
    render(<ShareInitialsControl initials={initials} collisions={['M. Naidoo']} onChange={onChange} />)

    await userEvent.click(screen.getByRole('checkbox', { name: 'First names as initials' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('ShareSponsorChooser (ShareCore)', () => {
  it('says so when there is no sponsor with a logo', () => {
    render(<ShareSponsorChooser sponsors={[]} selectedIds={[]} max={4} onChange={vi.fn()} />)
    expect(screen.getByText('No sponsors with a logo to choose from.')).toBeInTheDocument()
  })
})
