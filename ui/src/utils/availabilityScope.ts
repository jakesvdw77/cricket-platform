import type { Section } from '../api/sectionApi'
import { breadcrumbFor } from './sectionBreadcrumb'

// docs/specs/083-availability-filters-and-toolbars.md: the readable name of a chosen section, as the
// full root-first path ("Vets › Over 40"), shared by the FilterBar chips and each view's "Showing ..." text.
export function sectionPathLabel(sections: Section[], sectionId: string | null | undefined): string | null {
  if (!sectionId) return null
  const byId = new Map(sections.map((section) => [section.id, section]))
  const section = byId.get(sectionId)
  if (!section) return null
  return [...breadcrumbFor(section, byId), section.name].join(' › ')
}

// The set shared filters as text for the scope line, e.g. "Vets › Over 40 · Over 40 League".
export function scopeFilterText(parts: {
  sections?: Section[]
  sectionId?: string | null
  leagues?: { id: string; name: string }[]
  leagueId?: string | null
  teams?: { id: string; name: string }[]
  teamId?: string | null
}): string {
  const labels = [
    sectionPathLabel(parts.sections ?? [], parts.sectionId),
    parts.leagueId ? (parts.leagues ?? []).find((league) => league.id === parts.leagueId)?.name : null,
    parts.teamId ? (parts.teams ?? []).find((team) => team.id === parts.teamId)?.name : null,
  ].filter(Boolean)
  return labels.join(' · ')
}
