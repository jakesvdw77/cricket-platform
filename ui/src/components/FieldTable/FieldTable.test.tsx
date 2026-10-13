import { ThemeProvider } from '@mui/material'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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
  const onToggleHome = vi.fn()
  const onStatusAction = vi.fn()
  render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route path="/list" element={<FieldTable fields={fields} viewTo={(field) => `/manage/fixtures/fields/${field.id}`} onToggleHome={onToggleHome} {...props} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
  return { onToggleHome, onStatusAction }
}

// docs/specs/099-fields-directory.md (3)
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

  it('tints the first and third rows with the shared zebra tint', () => {
    renderTable([makeField({ id: 'a' }), makeField({ id: 'b' }), makeField({ id: 'c' })])
    const rows = screen.getAllByTestId('field-row')
    const tint = zebraTint(baseTheme)
    expect(rows[0]).toHaveStyle({ backgroundColor: tint })
    expect(rows[2]).toHaveStyle({ backgroundColor: tint })
    expect(rows[1]).not.toHaveStyle({ backgroundColor: tint })
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

    it('the row button sits above the link and does not navigate', async () => {
      const { onToggleHome } = renderTable([makeField({ id: 'f9' })])

      const button = screen.getByRole('button', { name: 'Add Riverside Oval to our fields' })
      expect(button).toHaveStyle({ position: 'relative' })
      await userEvent.click(button)

      expect(onToggleHome).toHaveBeenCalledWith(expect.objectContaining({ id: 'f9' }))
      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })
  })

  it('offers Remove for one of our fields', async () => {
    const { onToggleHome } = renderTable([makeField({ linkedHome: true })])

    await userEvent.click(screen.getByRole('button', { name: 'Remove Riverside Oval from our fields' }))

    expect(onToggleHome).toHaveBeenCalledTimes(1)
  })

  it('disables the button while that field\'s change is pending', () => {
    renderTable([makeField({ id: 'a' }), makeField({ id: 'b', name: 'Other' })], { homePendingId: 'a' })
    expect(screen.getByRole('button', { name: 'Add Riverside Oval to our fields' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Other to our fields' })).toBeEnabled()
  })

  describe('platform admin Status button', () => {
    it.each([
      ['UNVERIFIED', ['Verify', 'Reject…']],
      ['REJECTED', ['Reopen']],
    ] as const)('a %s field offers %j and reports the choice without navigating', async (verificationStatus, labels) => {
      const onStatusAction = vi.fn()
      renderTable([makeField({ id: 'f1', verificationStatus })], { onToggleHome: undefined, onStatusAction })

      await userEvent.click(screen.getByRole('button', { name: 'Change status' }))
      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(labels)
      await userEvent.click(screen.getAllByRole('menuitem')[0])

      expect(onStatusAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }), expect.any(String))
      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })

    it('disables the button, with a tooltip, for a verified field', () => {
      renderTable([makeField({ verificationStatus: 'VERIFIED' })], { onToggleHome: undefined, onStatusAction: vi.fn() })
      const button = screen.getByRole('button', { name: 'Change status' })
      expect(button).toBeDisabled()
      expect(button.closest('span[title]')).toHaveAttribute('title', 'A verified field has no status changes.')
    })
  })
})
