// docs/specs/149: the club a visitor came for is carried by the host of the address (riverside.example.com), never by a cookie or a
// stored hint. One pure module so the root-domain logic is not copied around (App, activeProfile and the landing dialog used to each
// hold a copy). No React in here.
const CONFIGURED_ROOT: string = import.meta.env.VITE_ROOT_DOMAIN ?? 'localhost:5173'

// With the port ('localhost:5173' by default, the Vite dev server): for building links to a club address. The hostname part is
// 'localhost' whether or not VITE_ROOT_DOMAIN is set.
export const rootDomain: string = CONFIGURED_ROOT

// Without the port: for comparing against window.location.hostname.
export const rootHostname: string = CONFIGURED_ROOT.split(':')[0]

export function isRootDomain(): boolean {
  return window.location.hostname === rootHostname
}

// The club slug in the current address, or null on the root domain (and on a host outside the root domain).
export function clubSlugFromHost(): string | null {
  const host = window.location.hostname
  return host.endsWith(`.${rootHostname}`) ? host.slice(0, -(rootHostname.length + 1)) : null
}

// The address of a page on a club's own host. Same scheme as the current page: HTTPS in production, HTTP for local development.
export function clubAddress(slug: string, path = '/'): string {
  return `${window.location.protocol}//${slug}.${rootDomain}${path}`
}

// The root (general) address of the platform, same scheme as the current page.
export function rootAddress(path = '/'): string {
  return `${window.location.protocol}//${rootDomain}${path}`
}
