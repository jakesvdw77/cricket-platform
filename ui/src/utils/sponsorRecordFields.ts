import type { RecordCardField } from '../components/RecordCard'
import type { Sponsor } from '../api/sponsorApi'

// The RecordCardField set for a Sponsor — shared by SponsorList.tsx's own cards and
// TeamFormPage.tsx's Sponsor RecordCards (docs/specs/027-team-profile.md), so both list a
// sponsor's key details identically rather than duplicating the logic a second time. Pulled out
// of SponsorList.tsx into its own utility (rather than exported straight from that page component)
// so importing it doesn't defeat React Fast Refresh on that file.
export function sponsorRecordFields(sponsor: Sponsor): RecordCardField[] {
  const fields: RecordCardField[] = []
  if (sponsor.website) {
    fields.push({ label: 'Website', value: sponsor.website })
  }
  if (sponsor.email) {
    fields.push({ label: 'Email', value: sponsor.email })
  }
  if (sponsor.phone) {
    fields.push({ label: 'Phone', value: sponsor.phone })
  }
  return fields
}
