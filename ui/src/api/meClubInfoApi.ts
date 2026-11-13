import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import type { ClubProfileType } from './clubApi'

// docs/specs/148-player-hub-club-info.md (API Contract): the selected player's club, read only. Mirrors MyClubInfoDto and
// MyClubContactPageDto exactly. A switched-off block arrives as null; the browser never hides data the server sent.

export type ClubInfoTabId = 'about' | 'contacts' | 'links'

export interface MyClubTab {
  id: ClubInfoTabId
  // null where the number is not known (About)
  count: number | null
}

export interface MyClubAddress {
  number: string | null
  street: string | null
  city: string | null
  provinceState: string | null
  country: string | null
  postalCode: string | null
}

export interface MyClubAbout {
  type: ClubProfileType | null
  address: MyClubAddress | null
  phone: string | null
  email: string | null
}

export interface MyClubSocialLink {
  platform: string
  url: string
}

export interface MyClubLinks {
  website: string | null
  social: MyClubSocialLink[]
}

export interface MyClubLogos {
  logoUrl: string | null
  bannerUrl: string | null
  downloadable: boolean
}

export interface MyClubDirectory {
  total: number
  phoneShown: boolean
  emailShown: boolean
}

export interface MyClubInfo {
  clubName: string
  tabs: MyClubTab[]
  about: MyClubAbout | null
  links: MyClubLinks | null
  logos: MyClubLogos | null
  directory: MyClubDirectory | null
}

export interface MyClubContact {
  id: string
  firstName: string
  lastName: string
  role: string | null
  primary: boolean
  phone: string | null
  email: string | null
}

export interface MyClubContactPage {
  items: MyClubContact[]
  letters: string[]
  page: number
  size: number
  total: number
  hasMore: boolean
}

export type ClubContactSort = 'name' | 'role'

export interface ClubContactParams {
  query: string
  sort: ClubContactSort
  letter: string | null
}

export const CLUB_CONTACTS_PAGE_SIZE = 25

export const clubInfoKeys = {
  all: (playerKey: string) => ['me', 'players', playerKey, 'club-info'] as const,
  info: (playerKey: string) => ['me', 'players', playerKey, 'club-info', 'info'] as const,
  contacts: (playerKey: string, params: ClubContactParams) => ['me', 'players', playerKey, 'club-info', 'contacts', params.query, params.sort, params.letter] as const,
}

export async function getMyClubInfo(playerKey: string): Promise<MyClubInfo> {
  const { data } = await api.get<MyClubInfo>(`/me/players/${playerKey}/club-info`)
  return data
}

export async function getMyClubContacts(playerKey: string, params: ClubContactParams, page: number, size: number): Promise<MyClubContactPage> {
  const query: Record<string, string | number> = { sort: params.sort, page, size }
  if (params.query.trim()) query.query = params.query.trim()
  if (params.letter) query.letter = params.letter
  const { data } = await api.get<MyClubContactPage>(`/me/players/${playerKey}/club-info/contacts`, { params: query })
  return data
}

export function useMyClubInfo(playerKey: string | undefined) {
  return useQuery({ queryKey: clubInfoKeys.info(playerKey as string), queryFn: () => getMyClubInfo(playerKey as string), enabled: Boolean(playerKey), retry: false })
}

// The directory, page by page: Show More asks the server for the next page and the pages are flattened here. Rows are never
// sliced in the browser. `letters` and `total` come from the last page (they describe the filtered set).
export function useMyClubContacts(playerKey: string | undefined, params: ClubContactParams, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: clubInfoKeys.contacts(playerKey as string, params),
    queryFn: ({ pageParam }) => getMyClubContacts(playerKey as string, params, pageParam, CLUB_CONTACTS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: Boolean(playerKey) && enabled,
    retry: false,
    placeholderData: keepPreviousData,
  })
  const pages = query.data?.pages ?? []
  return {
    ...query,
    lastPage: pages[pages.length - 1],
    items: pages.flatMap((page) => page.items),
  }
}
