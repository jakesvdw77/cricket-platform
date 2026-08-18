import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionForm } from './SubscriptionForm'

// Minimal stub to keep this component folder's four-file anatomy structurally complete —
// real coverage (Club/Product picker behaviour, validation, submit payload shape, the
// disabled-on-edit Club picker) is test-writer's pass, mirroring how ProductForm.test.tsx
// started before being fleshed out (see docs/plans/009-subscriptions.md).
function renderSubscriptionForm() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionForm onSubmit={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('SubscriptionForm', () => {
  it('renders without crashing', () => {
    renderSubscriptionForm()

    expect(screen.getByLabelText('Club')).toBeInTheDocument()
    expect(screen.getByLabelText('Product')).toBeInTheDocument()
  })
})
