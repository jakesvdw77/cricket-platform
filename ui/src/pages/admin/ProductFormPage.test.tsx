import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductFormPage from './ProductFormPage'
import type { Product } from '../../api/productApi'

const getProduct = vi.fn()
const createProduct = vi.fn()
const updateProduct = vi.fn()
const retireProduct = vi.fn()

vi.mock('../../api/productApi', () => ({
  getProduct: (id: string) => getProduct(id),
  createProduct: (payload: unknown) => createProduct(payload),
  updateProduct: (id: string, payload: unknown) => updateProduct(id, payload),
  retireProduct: (id: string) => retireProduct(id),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function draftProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    code: 'CLUB_STANDARD',
    name: 'Club Standard',
    description: null,
    isFree: true,
    price: null,
    currency: null,
    billingInterval: 'MONTHLY',
    maxPeriodMonths: null,
    maxSections: null,
    maxTeams: null,
    maxPlayers: null,
    status: 'DRAFT',
    displayOrder: 0,
    showAds: false,
    allowSubdomain: false,
    allowWhitelisting: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function renderPage(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin/configuration/products" element={<div>Product List Page</div>} />
          <Route path="/admin/configuration/products/new" element={<ProductFormPage />} />
          <Route path="/admin/configuration/products/:id/edit" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProductFormPage', () => {
  it(
    'create mode: does not fetch a product, and submit calls createProduct then navigates to the list',
    async () => {
      const user = userEvent.setup()
      createProduct.mockResolvedValueOnce(draftProduct())

      renderPage('/admin/configuration/products/new')

      expect(screen.getByText('Add Product')).toBeInTheDocument()
      expect(getProduct).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Code'), 'CLUB_STANDARD')
      await user.type(screen.getByLabelText('Name'), 'Club Standard')
      await user.type(screen.getByLabelText('Price'), '49.99')
      await user.type(screen.getByLabelText('Currency'), 'USD')
      await user.click(screen.getByRole('button', { name: 'Create product' }))

      expect(createProduct).toHaveBeenCalledTimes(1)
      const payload = createProduct.mock.calls[0][0]
      expect(payload).toMatchObject({ code: 'CLUB_STANDARD', name: 'Club Standard', isFree: false })
      expect(payload.status).toBeUndefined()

      expect(await screen.findByText('Product List Page')).toBeInTheDocument()
    },
    // Typing across five fields plus a submit-triggered mutation/navigation is consistently
    // slower than the 5s default under a loaded test run — see the matching note in
    // ProductForm.test.tsx. Not a hang: passes standalone in ~2s.
    15000,
  )

  it('edit mode: fetches and pre-fills the product, and submit calls updateProduct then navigates to the list', async () => {
    const user = userEvent.setup()
    getProduct.mockResolvedValueOnce(draftProduct({ name: 'Club Standard' }))
    updateProduct.mockResolvedValueOnce(draftProduct())

    renderPage('/admin/configuration/products/p-1/edit')

    expect(await screen.findByText('Edit Product')).toBeInTheDocument()
    expect(getProduct).toHaveBeenCalledWith('p-1')
    expect(await screen.findByDisplayValue('CLUB_STANDARD')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Club Standard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateProduct).toHaveBeenCalledTimes(1)
    const [id, payload] = updateProduct.mock.calls[0]
    expect(id).toBe('p-1')
    expect(payload).toMatchObject({ code: 'CLUB_STANDARD', status: 'DRAFT', displayOrder: 0 })

    expect(await screen.findByText('Product List Page')).toBeInTheDocument()
  })

  it('shows a Retire button for a non-retired product, requires inline confirm, and calls retireProduct', async () => {
    const user = userEvent.setup()
    getProduct.mockResolvedValueOnce(draftProduct({ status: 'ACTIVE' }))
    retireProduct.mockResolvedValueOnce(draftProduct({ status: 'RETIRED' }))

    renderPage('/admin/configuration/products/p-1/edit')

    const retireButton = await screen.findByRole('button', { name: 'Retire' })
    await user.click(retireButton)

    expect(screen.getByText('Retire this product?')).toBeInTheDocument()
    expect(retireProduct).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm retire' }))

    expect(retireProduct).toHaveBeenCalledWith('p-1')
    expect(await screen.findByText('Product List Page')).toBeInTheDocument()
  })

  it('cancelling the inline confirm does not call retireProduct', async () => {
    const user = userEvent.setup()
    getProduct.mockResolvedValueOnce(draftProduct({ status: 'ACTIVE' }))

    renderPage('/admin/configuration/products/p-1/edit')

    await user.click(await screen.findByRole('button', { name: 'Retire' }))
    await user.click(screen.getByRole('button', { name: "Don't retire" }))

    expect(screen.queryByText('Retire this product?')).not.toBeInTheDocument()
    expect(retireProduct).not.toHaveBeenCalled()
  })

  it('does not show a Retire button for an already-retired product', async () => {
    getProduct.mockResolvedValueOnce(draftProduct({ status: 'RETIRED' }))

    renderPage('/admin/configuration/products/p-1/edit')

    await screen.findByText('Edit Product')
    expect(screen.queryByRole('button', { name: 'Retire' })).not.toBeInTheDocument()
  })

  it('renders an error state instead of a blank page when fetching the product fails', async () => {
    getProduct.mockRejectedValueOnce(new Error('not found'))

    renderPage('/admin/configuration/products/p-1/edit')

    expect(await screen.findByText("Couldn't load this product")).toBeInTheDocument()
    expect(screen.getByText('Something went wrong loading this product. Please try again.')).toBeInTheDocument()
  })
})
