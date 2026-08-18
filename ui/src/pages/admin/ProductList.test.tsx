import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import ProductList from './ProductList'
import type { ListProductsParams, Page, Product } from '../../api/productApi'

const listProducts = vi.fn()

vi.mock('../../api/productApi', () => ({
  listProducts: (params: ListProductsParams) => listProducts(params),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    code: 'CLUB_STANDARD',
    name: 'Club Standard',
    description: 'Everything a growing club needs.',
    isFree: false,
    price: 49.99,
    currency: 'USD',
    billingInterval: 'MONTHLY',
    maxPeriodMonths: null,
    maxSections: 5,
    maxTeams: 10,
    maxPlayers: 200,
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

function emptyPage(): Page<Product> {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
}

function pageOf(content: Product[], totalPages = 1, number = 0): Page<Product> {
  return { content, totalElements: content.length, totalPages, number, size: 20 }
}

function renderProductList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/configuration/products']}>
        <Routes>
          <Route path="/admin/configuration/products" element={<ProductList />} />
          <Route path="/admin/configuration/products/new" element={<div>Add Product Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function waitForDebounce() {
  // ProductList debounces search into the query key ~300ms — see SEARCH_DEBOUNCE_MS.
  await new Promise((resolve) => setTimeout(resolve, 350))
}

describe('ProductList', () => {
  it('renders a paginated list of products via RecordCard', async () => {
    listProducts.mockResolvedValueOnce(pageOf([makeProduct()]))

    renderProductList()

    expect(await screen.findByText('Club Standard')).toBeInTheDocument()
    expect(screen.getByText('Everything a growing club needs.')).toBeInTheDocument()
    expect(screen.getByText('USD 49.99/month')).toBeInTheDocument()
    expect(screen.getByText('CLUB_STANDARD')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('5 sections')).toBeInTheDocument()
    expect(listProducts).toHaveBeenLastCalledWith({ page: 0, search: undefined, sort: 'displayOrder,asc' })
  })

  it('renders the empty state when there are no products', async () => {
    listProducts.mockResolvedValueOnce(emptyPage())

    renderProductList()

    expect(await screen.findByText('No products yet')).toBeInTheDocument()
  })

  it('renders an error state instead of a blank page when the fetch fails', async () => {
    listProducts.mockRejectedValueOnce(new Error('network error'))

    renderProductList()

    expect(await screen.findByText("Couldn't load products")).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong loading the product list. Please try again.'),
    ).toBeInTheDocument()
  })

  it('debounces search input into the query as the search param', async () => {
    listProducts.mockResolvedValueOnce(pageOf([makeProduct()]))

    renderProductList()
    await screen.findByText('Club Standard')

    listProducts.mockResolvedValueOnce(emptyPage())
    // A single atomic change (rather than per-keystroke typing) keeps this deterministic
    // under a loaded test run — the behaviour under test is the debounce window, not typing.
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })

    // Not queried again until the debounce window elapses.
    expect(listProducts).toHaveBeenCalledTimes(1)

    await waitForDebounce()

    expect(await screen.findByText('No matching products')).toBeInTheDocument()
    expect(listProducts).toHaveBeenLastCalledWith({ page: 0, search: 'zzz', sort: 'displayOrder,asc' })
  })

  it('re-queries with the selected sort value', async () => {
    const user = userEvent.setup()
    listProducts.mockResolvedValueOnce(pageOf([makeProduct()]))

    renderProductList()
    await screen.findByText('Club Standard')

    listProducts.mockResolvedValueOnce(pageOf([makeProduct()]))
    await user.click(screen.getByLabelText('Sort by'))
    await user.click(await screen.findByRole('option', { name: 'Price' }))

    expect(await screen.findByText('Club Standard')).toBeInTheDocument()
    expect(listProducts).toHaveBeenLastCalledWith({ page: 0, search: undefined, sort: 'price,asc' })
  })

  it('navigates to the create route via "Add Product"', async () => {
    const user = userEvent.setup()
    listProducts.mockResolvedValueOnce(pageOf([makeProduct()]))

    renderProductList()
    await screen.findByText('Club Standard')

    await user.click(screen.getByRole('button', { name: 'Add Product' }))

    expect(await screen.findByText('Add Product Page')).toBeInTheDocument()
  })

  it('Prev/Next controls respect totalPages', async () => {
    const user = userEvent.setup()
    listProducts.mockResolvedValueOnce(pageOf([makeProduct({ id: 'p-1', name: 'Page One Product' })], 2, 0))

    renderProductList()
    await screen.findByText('Page One Product')

    const prevButton = screen.getByRole('button', { name: 'Previous' })
    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    listProducts.mockResolvedValueOnce(pageOf([makeProduct({ id: 'p-2', name: 'Page Two Product' })], 2, 1))
    await user.click(nextButton)

    expect(await screen.findByText('Page Two Product')).toBeInTheDocument()
    expect(listProducts).toHaveBeenLastCalledWith({ page: 1, search: undefined, sort: 'displayOrder,asc' })
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
