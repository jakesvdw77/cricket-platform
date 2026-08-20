import api from './axiosConfig'
import type { ClubSummary } from './leadApi'
import type { Page } from './productApi'

// Re-exported for existing consumers that import Page from this file (same reasoning as the
// ClubSummary re-export below) — not redefined here, see the Page<T> note further down.
export type { Page }

export type SubscriptionOwnerType = 'CLUB' | 'SECTION'
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED'

// Re-exported so consumers of this file don't also need to know Subscription's Club summary
// comes from leadApi — same {id, name, slug} shape the backend's ClubSummaryDto returns,
// no reason to redefine it (docs/plans/009-subscriptions.md item 3).
export type { ClubSummary }

export interface ProductSummary {
  id: string
  name: string
  code: string
}

// The generic, unscoped four-field contact shape — mirrors ContactDto on the backend. Canonical
// home is here (this spec's first consumer); a future clubContactApi.ts imports `type { Contact }
// from './subscriptionApi'` rather than redefining it, per
// docs/specs/014-subscription-responsible-contact.md's UI Requirements.
export interface Contact {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

export interface Subscription {
  id: string
  ownerType: SubscriptionOwnerType
  ownerId: string
  club: ClubSummary
  product: ProductSummary
  status: SubscriptionStatus
  startDate: string
  endDate: string | null
  // null for Subscriptions created before 014 shipped — no backfill, see that spec's Non-goals.
  responsibleContact: Contact | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Create shape — mirrors CreateSubscriptionRequest. ownerType/ownerId are only ever CLUB-owned
// through this UI (see docs/specs/009-subscriptions.md's Non-goals), but the field stays
// present so the payload matches the backend's request shape exactly.
export interface SubscriptionPayload {
  ownerType: SubscriptionOwnerType
  ownerId: string
  productId: string
  startDate?: string | null
  endDate?: string | null
  // Required, matching CreateSubscriptionRequest's @NotNull @Valid — every new Subscription must
  // record who's accountable for it.
  responsibleContact: Contact
}

// Update shape — mirrors UpdateSubscriptionRequest. No ownerId/ownerType: the owning Club
// can't change after creation, only the Product/dates can.
export interface UpdateSubscriptionPayload {
  productId: string
  startDate?: string | null
  endDate?: string | null
  // Optional, full-replace-when-provided — omitted/null clears any previously-set contact, per
  // UpdateSubscriptionRequest's posture. The frontend must always submit the Subscription's
  // current full contact state, not a sparse diff (see the backend DTO's own doc comment).
  responsibleContact?: Contact | null
}

// Page<T> is imported from productApi.ts (see above) rather than redefined here — same Spring
// Data Page<T> JSON envelope, no reason for a second copy of the shape.

export interface ListSubscriptionsParams {
  page: number
  size?: number
  // Case-insensitive substring match against the owning Club's name — omitted/blank returns
  // everything.
  search?: string
  // Spring Data's native Pageable sort format, e.g. 'startDate,desc'.
  sort?: string
}

export async function listSubscriptions({
  page,
  size = 20,
  search,
  sort,
}: ListSubscriptionsParams): Promise<Page<Subscription>> {
  const { data } = await api.get<Page<Subscription>>('/platform/subscriptions', {
    params: {
      page,
      size,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    },
  })
  return data
}

export async function getSubscription(id: string): Promise<Subscription> {
  const { data } = await api.get<Subscription>(`/platform/subscriptions/${id}`)
  return data
}

export async function createSubscription(payload: SubscriptionPayload): Promise<Subscription> {
  const { data } = await api.post<Subscription>('/platform/subscriptions', payload)
  return data
}

export async function updateSubscription(
  id: string,
  payload: UpdateSubscriptionPayload,
): Promise<Subscription> {
  const { data } = await api.put<Subscription>(`/platform/subscriptions/${id}`, payload)
  return data
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  const { data } = await api.post<Subscription>(`/platform/subscriptions/${id}/cancel`)
  return data
}
