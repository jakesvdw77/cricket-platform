import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { FieldTable } from './FieldTable'
import type { FieldTableProps } from './FieldTable'
import type { PlayingArea } from '../../api/playingAreaApi'
import { baseTheme } from '../../theme'
import { makeField } from '../../test/fieldFixtures'
import { zebraTint } from '../../utils/zebraTint'

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderTable(fields: PlayingArea[], props: Partial<FieldTableProps> = {}) {
  render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route path="/list" element={<FieldTable fields={fields} viewTo={(field) => `/manage/fixtures/fields/${field.id}`} {...props} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

// docs/specs/099-fields-directory.md (3) and docs/specs/134
describe('FieldTable', () => {
  it('has a header row with every column and one row per field', () => {
    renderTable([makeField({ id: 'a' }), makeField({ id: 'b', name: 'Hilton Ground' })])

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Field', 'Status', 'Type', 'Owner', 'City', 'Province', 'Matches', '',
    ])
    expect(screen.getAllByTestId('field-row')).toHaveLength(2)
    expect(screen.getByRole('table', { name: 'Fields' })).toBeInTheDocument()
  })

  it('a phone keeps Field, City and the button; Status, Type, Owner, Province and Matches are desktop-only', () => {
    renderTable([makeField()])

    const headers = screen.getAllByRole('columnheader')
    expect(headers.filter((h) => h.hasAttribute('data-desktop-only')).map((h) => h.textContent)).toEqual(['Status', 'Type', 'Owner', 'Province', 'Matches'])
    expect(headers.filter((h) => !h.hasAttribute('data-desktop-only')).map((h) => h.textContent)).toEqual(['Field', 'City', ''])
  })

  it('keeps the header sticky and gives every row the same eight cells', () => {
    renderTable([makeField({ id: 'a' }), makeField({ id: 'b', ownerName: '' })])

    expect(screen.getAllByRole('columnheader')[0].parentElement).toHaveStyle({ position: 'sticky', top: '0px' })
    for (const row of screen.getAllByTestId('field-row')) {
      expect(within(row).getAllByRole('cell')).toHaveLength(8)
    }
  })

  it('shows the values, and the dash for everything not on file', () => {
    renderTable([
      makeField({ id: 'a', matchCount: 7 }),
      makeField({ id: 'b', name: 'Bare Field', ownerName: '', matchCount: undefined, address: { number: null, street: null, city: null, provinceState: null, country: 'ZA', postalCode: null } }),
    ])

    // the first cell also holds the avatar initials and the badge a phone shows under the name
    const [full, empty] = screen.getAllByTestId('field-row')
    expect(within(full).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'RORiverside OvalVerified', 'Verified', 'Club', 'Riverside CC', 'Hilton', 'KwaZulu-Natal', '7', '',
    ])
    expect(within(empty).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'BFBare FieldVerified', 'Verified', 'Club', '–', '–', '–', '0', '',
    ])
  })

  it('shows the badge for every status', () => {
    renderTable([
      makeField({ id: 'a', verificationStatus: 'VERIFIED' }),
      makeField({ id: 'b', verificationStatus: 'UNVERIFIED' }),
      makeField({ id: 'c', verificationStatus: 'REJECTED' }),
    ])
    expect(screen.getAllByTestId('field-status-badge-desktop').map((badge) => badge.textContent)).toEqual(['Verified', 'Unverified', 'Rejected'])
  })

  it('tints the header and the second row, so the first data row is white (zebra parity)', () => {
    renderTable([makeField({ id: 'a' }), makeField({ id: 'b' }), makeField({ id: 'c' })])
    const rows = screen.getAllByTestId('field-row')
    const tint = zebraTint(baseTheme)
    expect(screen.getAllByRole('columnheader')[0].parentElement).toHaveStyle({ backgroundColor: tint })
    expect(rows[1]).toHaveStyle({ backgroundColor: tint })
    expect(rows[0]).not.toHaveStyle({ backgroundColor: tint })
    expect(rows[2]).not.toHaveStyle({ backgroundColor: tint })
  })

  it('is a flat card (no shadow) with no chevron or open arrow', () => {
    renderTable([makeField()])
    expect(getComputedStyle(screen.getByRole('table', { name: 'Fields' })).boxShadow).toBe('none')
    expect(screen.queryByTestId('ChevronRightIcon')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ArrowForwardIosIcon')).not.toBeInTheDocument()
  })

  it('fuses the toolbar into one card with the table, and shows the empty message in that card', () => {
    renderTable([], { toolbar: <div>Toolbar here</div>, empty: <p>Nothing here</p> })
    const card = screen.getByTestId('fields-fused-card')
    expect(within(card).getByText('Toolbar here')).toBeInTheDocument()
    expect(within(card).getByText('Nothing here')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the row actions at the right end of every row', () => {
    renderTable([makeField({ id: 'a' }), makeField({ id: 'b' })], { rowActions: (field) => <button type="button">Actions {field.id}</button> })
    const [first] = screen.getAllByTestId('field-row')
    const cells = within(first).getAllByRole('cell')
    expect(within(cells[cells.length - 1]).getByRole('button', { name: 'Actions a' })).toBeInTheDocument()
  })

  describe('opening the field', () => {
    it('the name is a link to the field over a row that holds the whole click area', async () => {
      renderTable([makeField({ id: 'f9', name: 'Hilton Ground' })])

      const link = screen.getByRole('link', { name: 'Hilton Ground' })
      expect(link).toHaveAttribute('href', '/manage/fixtures/fields/f9')
      expect(screen.getByTestId('field-row')).toHaveStyle({ position: 'relative' })

      await userEvent.click(link)
      expect(await screen.findByText('At: /manage/fixtures/fields/f9')).toBeInTheDocument()
    })

    it('a row button sits above the link and does not navigate', async () => {
      renderTable([makeField({ id: 'f9' })], { rowActions: () => <button type="button" style={{ position: 'relative' }}>Row action</button> })

      await userEvent.click(screen.getByRole('button', { name: 'Row action' }))

      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })
  })
})
