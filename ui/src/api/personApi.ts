import api from './axiosConfig'
import type { Page } from './productApi'

// Same Spring Data Page<T> JSON envelope productApi.ts already defines — re-exported so
// consumers of this file don't also need to know it comes from productApi.ts, same precedent
// clubApi.ts/subscriptionApi.ts already follow.
export type { Page }

// Read shape of GET /platform/persons — mirrors PersonDto exactly. See
// docs/specs/014-subscription-responsible-contact.md's UI Requirements/API Contract.
export interface Person {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
}

// The four fields CreateSubscriptionRequest.responsiblePerson (ResponsiblePersonRequest) takes —
// phone is always a string here (never null), matching the backend's optional-but-string
// (defaults to blank, not null) shape for a freshly-typed draft.
export interface ResponsiblePersonInput {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface ListPersonsParams {
  page: number
  size?: number
  // Case-insensitive substring match against first name, last name, OR email — omitted/blank
  // returns everything. No status filter — Person has no lifecycle field the way Club does.
  search?: string
}

export async function listPersons({ page, size = 20, search }: ListPersonsParams): Promise<Page<Person>> {
  const { data } = await api.get<Page<Person>>('/platform/persons', {
    params: {
      page,
      size,
      ...(search ? { search } : {}),
    },
  })
  return data
}
