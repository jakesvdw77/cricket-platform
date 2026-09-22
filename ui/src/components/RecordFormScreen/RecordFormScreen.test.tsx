import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RecordFormScreen } from './RecordFormScreen'
import { baseTheme } from '../../theme'

describe('RecordFormScreen', () => {
  it('renders a Back action, title, fields, and actions', () => {
    render(
      <MemoryRouter initialEntries={['/products/p-1/edit']}>
        <Routes>
          <Route
            path="/products/p-1/edit"
            element={
              <RecordFormScreen
                title="Edit Product"
                backTo="/products"
                backLabel="Back to Products"
                actions={<button type="button">Save</button>}
              >
                <div>Field content</div>
              </RecordFormScreen>
            }
          />
          <Route path="/products" element={<div>Product List Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /back to products/i })).toHaveAttribute('href', '/products')
    expect(screen.getByRole('heading', { name: 'Edit Product' })).toBeInTheDocument()
    expect(screen.getByText('Field content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  // docs/specs/046-header-body-elevation-standard.md
  it('renders the header (Back link/title) inside a PageHeaderBand', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <MemoryRouter initialEntries={['/products/p-1/edit']}>
          <Routes>
            <Route
              path="/products/p-1/edit"
              element={
                <RecordFormScreen
                  title="Edit Product"
                  backTo="/products"
                  backLabel="Back to Products"
                  actions={<button type="button">Save</button>}
                >
                  <div>Field content</div>
                </RecordFormScreen>
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    // PageHeaderBand renders a single Box wrapping the Back link + title directly — the Back
    // link's own DOM parent is that Box, carrying PageHeaderBand's own distinguishing treatment.
    const backLink = screen.getByRole('link', { name: /back to products/i })
    const band = backLink.parentElement as HTMLElement

    expect(band).toContainElement(screen.getByRole('heading', { name: 'Edit Product' }))
    expect(band).toHaveStyle({
      backgroundColor: 'rgb(255, 255, 255)',
      borderTopWidth: '3px',
      borderTopStyle: 'solid',
      borderTopColor: 'rgb(47, 110, 79)', // baseTheme.palette.primary.main
    })
  })

  // docs/specs/046-header-body-elevation-standard.md
  it('renders the field grid and the actions bar together inside one ContentCard', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <MemoryRouter initialEntries={['/products/p-1/edit']}>
          <Routes>
            <Route
              path="/products/p-1/edit"
              element={
                <RecordFormScreen
                  title="Edit Product"
                  backTo="/products"
                  backLabel="Back to Products"
                  actions={<button type="button">Save</button>}
                >
                  <div>Field content</div>
                </RecordFormScreen>
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    const fieldContent = screen.getByText('Field content')
    const saveButton = screen.getByRole('button', { name: 'Save' })
    // The field grid is `<Box>{children}</Box>` and the actions bar is a sibling `<Box>` — both
    // direct children of the same ContentCard, so their nearest shared ancestor is that one card.
    const fieldGrid = fieldContent.parentElement as HTMLElement
    const actionsBar = saveButton.parentElement as HTMLElement
    const card = fieldGrid.parentElement as HTMLElement

    expect(actionsBar.parentElement).toBe(card) // same card, not a second one
    expect(card).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' })
    expect(getComputedStyle(card).boxShadow).not.toBe('')
  })

  // docs/specs/046-header-body-elevation-standard.md
  it('renders the title at fontWeight 700', () => {
    render(
      <ThemeProvider theme={baseTheme}>
        <MemoryRouter initialEntries={['/products/p-1/edit']}>
          <Routes>
            <Route
              path="/products/p-1/edit"
              element={
                <RecordFormScreen title="Edit Product" backTo="/products" backLabel="Back to Products" actions={null}>
                  <div>Field content</div>
                </RecordFormScreen>
              }
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Edit Product' })).toHaveStyle({ fontWeight: '700' })
  })
})
