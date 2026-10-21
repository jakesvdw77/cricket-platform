export interface BackTarget {
  to: string
  label: string
}

// docs/specs/115-player-match-list.md and docs/specs/116-team-stats.md: a page that links to another may pass router state
// { backTo, backLabel } so the target's Back link returns to it. Only an in-app /manage/ address is followed (never an absolute
// URL, a protocol-relative '//' address or one with a backslash); anything else gives the fallback. A blank label reads
// "previous page".
export function backTarget(state: unknown, fallback: BackTarget): BackTarget {
  const candidate = state as { backTo?: unknown; backLabel?: unknown } | null | undefined
  const to = candidate?.backTo
  if (typeof to === 'string' && to.startsWith('/manage/') && !to.startsWith('//') && !to.includes('\\')) {
    const label = typeof candidate?.backLabel === 'string' && candidate.backLabel.trim() ? candidate.backLabel.trim() : 'previous page'
    return { to, label }
  }
  return fallback
}
