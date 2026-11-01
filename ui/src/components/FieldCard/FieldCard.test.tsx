import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FieldCard } from './FieldCard'
import type { FieldCardProps } from './FieldCard'
import { baseTheme } from '../../theme'
import { makeField } from '../../test/fieldFixtures'

function renderCard(props: Partial<FieldCardProps> = {}) {
  return render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter>
        <FieldCard field={makeField()} viewTo="/manage/fixtures/fields/field-1" {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const ROWS = ['Owner', 'City', 'Country', 'Matches', 'Map']
const EMPTY = makeField({
  ownerName: '',
  address: { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null },
  mapUrl: null,
  matchCount: undefined,
})

// docs/specs/099-fields-directory.md and docs/specs/134
describe('FieldCard', () => {
  it('shows the name as a heading linking to the field', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: 'Riverside Oval' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Riverside Oval' })).toHaveAttribute('href', '/manage/fixtures/fields/field-1')
  })

  it('has no footer action bar: no Edit, View, Status or Add to our fields controls', () => {
    renderCard()

    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is flat: a hairline border and no shadow', () => {
    renderCard()
    const card = screen.getByRole('heading', { name: 'Riverside Oval' }).closest('.MuiCard-root') as HTMLElement
    expect(getComputedStyle(card).boxShadow).toBe('none')
  })

  it('renders the actions node it is given in the corner', () => {
    renderCard({ actions: <button type="button">Actions for Riverside Oval</button> })
    expect(screen.getByRole('button', { name: 'Actions for Riverside Oval' })).toBeInTheDocument()
  })

  it.each([
    ['VERIFIED', 'Verified'],
    ['UNVERIFIED', 'Unverified'],
    ['REJECTED', 'Rejected'],
  ] as const)('shows the %s status as a badge', (verificationStatus, label) => {
    renderCard({ field: makeField({ verificationStatus }) })
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('puts the verification badge before the Type chip and the Our field marker', () => {
    renderCard({ field: makeField({ linkedHome: true }) })
    const verified = screen.getByText('Verified').closest('.MuiChip-root') as HTMLElement
    expect(Array.from(verified.parentElement!.children).map((el) => el.textContent)).toEqual(['Verified', 'Club', 'Our field'])
  })

  it('marks a field the club has not linked as Not our field', () => {
    renderCard({ field: makeField({ linkedHome: false }) })
    expect(screen.getByText('Not our field')).toBeInTheDocument()
  })

  it.each(['VERIFIED', 'UNVERIFIED', 'REJECTED'] as const)('has the same detail rows whatever the status (%s)', (verificationStatus) => {
    renderCard({ field: makeField({ verificationStatus, createdByClubId: 'club-1' }) })

    const rows = screen.getAllByTestId('field-detail-row')
    expect(rows.map((row) => ROWS.find((label) => within(row).queryByText(label)))).toEqual(ROWS)
  })

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

  describe('platform admin variant', () => {
    it('adds captured, clubs and similar rows and leaves out the Our field marker', () => {
      renderCard({
        admin: true,
        field: makeField({ verificationStatus: 'VERIFIED', linkedClubCount: 2, matchCount: 1, possibleDuplicates: [{ id: 'x', name: 'Riverside Ovals' }] }),
      })

      const rows = screen.getAllByTestId('field-detail-row').map((row) => row.textContent)
      expect(rows).toContain('CapturedRiverside CC')
      expect(rows).toContain('Clubs2 clubs · 1 match')
      expect(rows).toContain('SimilarRiverside Ovals')
      expect(screen.queryByText('Our field')).not.toBeInTheDocument()
      expect(screen.queryByText('Not our field')).not.toBeInTheDocument()
    })
  })
})
