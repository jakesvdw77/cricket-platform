import type { Section } from '../api/sectionApi'

type AgeBounds = Pick<Section, 'minAge' | 'maxAge'>

// Compact label for chips: "6–9" (en dash), "40+", "Under 12", or null when no age is set.
export function ageRangeLabel(section: AgeBounds): string | null {
  if (section.minAge != null && section.maxAge != null) {
    return `${section.minAge}–${section.maxAge}`
  }
  if (section.minAge != null) {
    return `${section.minAge}+`
  }
  if (section.maxAge != null) {
    return `Under ${section.maxAge}`
  }
  return null
}

// Written-out form for detail text: "6 to 9 years", "40 and over", "Under 12", "Not set".
export function ageRangeWritten(section: AgeBounds): string {
  if (section.minAge != null && section.maxAge != null) {
    return `${section.minAge} to ${section.maxAge} years`
  }
  if (section.minAge != null) {
    return `${section.minAge} and over`
  }
  if (section.maxAge != null) {
    return `Under ${section.maxAge}`
  }
  return 'Not set'
}
