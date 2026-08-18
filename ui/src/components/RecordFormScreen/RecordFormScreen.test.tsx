import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RecordFormScreen } from './RecordFormScreen'

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
})
