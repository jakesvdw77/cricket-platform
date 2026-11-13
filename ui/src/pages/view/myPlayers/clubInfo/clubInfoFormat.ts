import type { MyClubAddress } from '../../../../api/meClubInfoApi'

// docs/specs/148 (Club info): pure helpers for the hrefs and file names. Nothing here touches the network.

// A dialable `tel:` link: digits with an optional leading +, spaces, dashes, dots and brackets are dropped. Letters (or nothing) give null.
export function phoneHref(phone: string | null | undefined): string | null {
  const raw = (phone ?? '').trim()
  if (!raw || /[A-Za-z]/.test(raw)) return null
  const cleaned = raw.replace(/[\s\-.()]/g, '')
  if (!/^\+?\d+$/.test(cleaned)) return null
  return `tel:${cleaned}`
}

export function emailHref(email: string | null | undefined): string | null {
  const value = (email ?? '').trim()
  if (!/^[^\s@<>,;:"]+@[^\s@<>,;:"]+\.[^\s@<>,;:"]+$/.test(value)) return null
  return `mailto:${value}`
}

// The address as the lines the page shows: street; city, province postal code; country.
export function addressLines(address: MyClubAddress | null | undefined): string[] {
  if (!address) return []
  const street = [address.number, address.street].filter(Boolean).join(' ')
  const region = [address.provinceState, address.postalCode].filter(Boolean).join(' ')
  return [street, [address.city, region].filter(Boolean).join(', '), address.country ?? ''].map((line) => line.trim()).filter(Boolean)
}

// Only the address text leaves the browser. Null when there is no address.
export function mapsUrl(lines: readonly string[]): string | null {
  const text = lines.map((line) => line.trim()).filter(Boolean).join(', ')
  return text ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}` : null
}

// A to Z for the jump strip; anything else (a digit, an accent-less symbol, nothing) is '#'.
export function letterOf(name: string | null | undefined): string {
  const first = (name ?? '').trim().charAt(0).toUpperCase()
  return /^[A-Z]$/.test(first) ? first : '#'
}

const slug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'club'

// The suggested download name: <club-slug>-logo.<ext> or <club-slug>-banner.<ext>, the extension of the stored file (png when unknown).
export function logoFileName(club: string, kind: 'logo' | 'banner', url: string): string {
  const path = url.split(/[?#]/)[0]
  const ext = /\.([A-Za-z0-9]{2,5})$/.exec(path)?.[1]?.toLowerCase() ?? 'png'
  return `${slug(club)}-${kind}.${ext}`
}
