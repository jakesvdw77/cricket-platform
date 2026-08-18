import api from './axiosConfig'

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED'
export type BillingInterval = 'MONTHLY' | 'ANNUAL'

export interface Product {
  id: string
  code: string
  name: string
  description: string | null
  isFree: boolean
  price: number | null
  currency: string | null
  billingInterval: BillingInterval
  maxPeriodMonths: number | null
  maxSections: number | null
  maxTeams: number | null
  maxPlayers: number | null
  status: ProductStatus
  displayOrder: number
  showAds: boolean
  allowSubdomain: boolean
  allowWhitelisting: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Shared editable fields between create and update. `displayOrder`/`status` and
// `showAds`/`allowSubdomain`/`allowWhitelisting` are optional here and made required
// by `UpdateProductPayload` below — the server's CreateProductRequest/
// UpdateProductRequest split (these fields are optional/nullable on create, where
// omitting them means "use the entity's default", but required on update).
export interface ProductPayload {
  code: string
  name: string
  description?: string | null
  isFree: boolean
  price?: number | null
  currency?: string | null
  billingInterval?: BillingInterval | null
  maxPeriodMonths?: number | null
  maxSections?: number | null
  maxTeams?: number | null
  maxPlayers?: number | null
  displayOrder?: number | null
  showAds?: boolean | null
  allowSubdomain?: boolean | null
  allowWhitelisting?: boolean | null
  // Only meaningful once a product already exists (edit mode) — create mode
  // never sets this, the server defaults a new product to DRAFT. Stripped
  // before it's sent to createProduct (see ProductFormPage).
  status?: ProductStatus
}

export interface UpdateProductPayload extends Omit<ProductPayload, 'status'> {
  displayOrder: number
  status: Extract<ProductStatus, 'DRAFT' | 'ACTIVE'>
  showAds: boolean
  allowSubdomain: boolean
  allowWhitelisting: boolean
}

// Matches Spring Data's standard Page<T> JSON envelope — first paginated
// resource in this frontend, see docs/plans/008-product-catalog.md Flag #5.
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface ListProductsParams {
  page: number
  size?: number
  // Case-insensitive substring match against name OR code — omitted/blank returns everything.
  search?: string
  // Spring Data's native Pageable sort format, e.g. 'name,asc'.
  sort?: string
}

export async function listProducts({ page, size = 20, search, sort }: ListProductsParams): Promise<Page<Product>> {
  const { data } = await api.get<Page<Product>>('/platform/products', {
    params: {
      page,
      size,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    },
  })
  return data
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await api.get<Product>(`/platform/products/${id}`)
  return data
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const { data } = await api.post<Product>('/platform/products', payload)
  return data
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const { data } = await api.put<Product>(`/platform/products/${id}`, payload)
  return data
}

export async function retireProduct(id: string): Promise<Product> {
  const { data } = await api.post<Product>(`/platform/products/${id}/retire`)
  return data
}
