import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { FieldCard } from './FieldCard'
import type { FieldCardProps } from './FieldCard'
import { baseTheme } from '../../theme'
import { makeField } from '../../test/fieldFixtures'

function renderCard(props: Partial<FieldCardProps> = {}) {
  const onToggleHome = vi.fn()
  const onStatusAction = vi.fn()
  const view = render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter>
        <FieldCard
          field={makeField()}
          clubId="club-1"
          viewTo="/manage/fixtures/fields/field-1"
          editTo="/manage/fixtures/fields/field-1/edit"
          onToggleHome={onToggleHome}
          {...props}
        />
      </MemoryRouter>
    </ThemeProvider>,
  )
  return { onToggleHome, onStatusAction, ...view }
}

const ROWS = ['Owner', 'City', 'Country', 'Matches', 'Map']
const EMPTY = makeField({
  ownerName: '',
  address: { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null },
  mapUrl: null,
  matchCount: undefined,
})

// docs/specs/099-fields-directory.md
describe('FieldCard', () => {
  it('shows the name as a heading linking to the field, with Edit and View in the footer', () => {
    renderCard({ field: makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }) })

    expect(screen.getByRole('heading', { name: 'Riverside Oval' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Riverside Oval' })).toHaveAttribute('href', '/manage/fixtures/fields/field-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/fixtures/fields/field-1/edit')
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/manage/fixtures/fields/field-1')
  })

  it.each([
    ['VERIFIED', 'Verified'],
    ['UNVERIFIED', 'Unverified'],
    ['REJECTED', 'Rejected'],
  ] as const)('shows the %s status as the badge', (verificationStatus, label) => {
    renderCard({ field: makeField({ verificationStatus }) })
    expect(screen.getByTestId('field-status-badge')).toHaveTextContent(label)
  })

  it('puts the verification badge before the Type chip and the Our field marker', () => {
    renderCard({ field: makeField({ linkedHome: true }) })
    const chips = Array.from(screen.getByTestId('field-status-badge').parentElement!.children).map((el) => el.textContent)
    expect(chips).toEqual(['Verified', 'Club', 'Our field'])
  })

  it('marks a field the club has not linked as Not our field', () => {
    renderCard({ field: makeField({ linkedHome: false }) })
    expect(screen.getByTestId('field-ours-chip')).toHaveTextContent('Not our field')
  })

  it.each(['VERIFIED', 'UNVERIFIED', 'REJECTED'] as const)(
    'has the same detail rows and the same three footer controls whatever the status (%s)',
    (verificationStatus) => {
      renderCard({ field: makeField({ verificationStatus, createdByClubId: 'club-1' }) })

      const rows = screen.getAllByTestId('field-detail-row')
      expect(rows.map((row) => ROWS.find((label) => within(row).queryByText(label)))).toEqual(ROWS)
      expect(screen.getByRole('button', { name: 'Add to our fields' })).toBeInTheDocument()
      expect(screen.getByLabelText('Edit')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'View' })).toBeInTheDocument()
    },
  )

  it('shows the dash for every empty value but keeps all the rows', () => {
    renderCard({ field: EMPTY })

    const rows = screen.getAllByTestId('field-detail-row')
    expect(rows).toHaveLength(ROWS.length)
    expect(rows.map((row) => row.textContent)).toEqual(['Owner–', 'City–', 'Country–', 'Matches0', 'Map–'])
    expect(screen.queryByRole('link', { name: 'Open in maps' })).not.toBeInTheDocument()
  })

  it('links the map when there is one', () => {
    renderCard()
    expect(screen.getByRole('link', { name: 'Open in maps' })).toHaveAttribute('href', 'https://maps.example.com/riverside')
  })

  describe('Edit', () => {
    it('is a link for the club that captured an unverified field', () => {
      renderCard({ field: makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }) })
      expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument()
    })

    it('is disabled, not hidden, on a verified field, with the reason as its tooltip', () => {
      renderCard({ field: makeField({ verificationStatus: 'VERIFIED' }) })

      const edit = screen.getByTestId('field-edit-disabled')
      expect(edit).toBeDisabled()
      expect(edit.closest('span[title]')).toHaveAttribute('title', 'Only a platform admin can change a verified field.')
      expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    })

    it('is disabled on another club\'s unverified field', () => {
      renderCard({ field: makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-2' }) })

      const edit = screen.getByTestId('field-edit-disabled')
      expect(edit).toBeDisabled()
      expect(edit.closest('span[title]')?.getAttribute('title')).toMatch(/club that captured/)
    })
  })

  describe('Our fields link button', () => {
    it('adds a field that is not ours', async () => {
      const field = makeField({ linkedHome: false })
      const { onToggleHome } = renderCard({ field })

      await userEvent.click(screen.getByRole('button', { name: 'Add to our fields' }))

      expect(onToggleHome).toHaveBeenCalledWith(field)
    })

    it('offers Remove for one of our fields', async () => {
      const field = makeField({ linkedHome: true })
      const { onToggleHome } = renderCard({ field })

      await userEvent.click(screen.getByRole('button', { name: 'Remove from our fields' }))

      expect(onToggleHome).toHaveBeenCalledWith(field)
    })

    it('is disabled while the change is pending', () => {
      renderCard({ homePending: true })
      expect(screen.getByRole('button', { name: 'Add to our fields' })).toBeDisabled()
    })
  })

  describe('platform admin variant', () => {
    const admin = (field = makeField({ verificationStatus: 'UNVERIFIED' })) => renderCard({ field, onStatusAction: vi.fn(), onToggleHome: undefined, clubId: undefined })

    it('swaps the link button for Status, keeps Edit enabled and adds captured, clubs and similar rows', () => {
      admin(makeField({ verificationStatus: 'VERIFIED', linkedClubCount: 2, matchCount: 1, possibleDuplicates: [{ id: 'x', name: 'Riverside Ovals' }] }))

      expect(screen.queryByRole('button', { name: 'Add to our fields' })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument()
      const rows = screen.getAllByTestId('field-detail-row').map((row) => row.textContent)
      expect(rows).toContain('CapturedRiverside CC')
      expect(rows).toContain('Clubs2 clubs · 1 match')
      expect(rows).toContain('SimilarRiverside Ovals')
      expect(screen.queryByTestId('field-ours-chip')).not.toBeInTheDocument()
    })

    it('disables Status with a tooltip for a verified field', () => {
      admin(makeField({ verificationStatus: 'VERIFIED' }))
      const status = screen.getByRole('button', { name: 'Change status' })
      expect(status).toBeDisabled()
      expect(status.closest('span[title]')).toHaveAttribute('title', 'A verified field has no status changes.')
    })

    it('opens the menu of valid changes for an unverified field and reports the choice', async () => {
      const onStatusAction = vi.fn()
      renderCard({ field: makeField({ verificationStatus: 'UNVERIFIED' }), onStatusAction, clubId: undefined })

      await userEvent.click(screen.getByRole('button', { name: 'Change status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Verify', 'Reject…'])
      await userEvent.click(screen.getByRole('menuitem', { name: 'Verify' }))

      expect(onStatusAction).toHaveBeenCalledWith('verify')
    })
  })
})
