import { Box, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { RecordQuickViewDialog } from '../RecordQuickViewDialog'
import { listSponsorContacts } from '../../api/sponsorContactApi'
import { initialsFromName } from '../../utils/initials'
import type { Sponsor } from '../../api/sponsorApi'

export interface SponsorQuickViewDialogProps {
  clubId: string
  // null (dialog closed) rather than a separate `open` boolean — the caller only ever has a
  // sponsor to show once one is actually selected, same posture as its own `open={Boolean(...)}`
  // callers already had before this was extracted.
  sponsor: Sponsor | null
  onClose: () => void
}

// Shared by TeamCard.tsx (sponsor logos) and TeamDetailPage.tsx (Sponsors icon grid) — both
// click-to-open the same Website/Email/Sponsor Contacts quick view. Extracted after standards
// review on docs/specs/057-team-extended-profile.md's live-feedback round flagged this dialog and
// its sponsor-contacts fetch as near-verbatim duplicated between the two call sites, well past
// docs/standards/frontend.md's 70% reuse threshold — fixed here rather than left as a third
// hand-copied instance for docs/roadmap.md's existing TeamCard/RecordCard duplication entry to
// eventually absorb.
export function SponsorQuickViewDialog({ clubId, sponsor, onClose }: SponsorQuickViewDialogProps) {
  // Only fetched once a sponsor is actually selected — mirrors every other "fetch while a dialog
  // is open" query in this codebase (e.g. LinkExistingRecordDialog's own candidate-list queries).
  const sponsorContactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors', sponsor?.id, 'contacts'],
    queryFn: () => listSponsorContacts(clubId, sponsor?.id as string),
    enabled: Boolean(sponsor),
  })

  return (
    <RecordQuickViewDialog
      open={Boolean(sponsor)}
      onClose={onClose}
      avatar={{
        imageUrl: sponsor?.logoUrl,
        fallback: initialsFromName(sponsor ? sponsor.name : ''),
        shape: 'rounded',
      }}
      title={sponsor ? sponsor.name : ''}
      fields={
        sponsor
          ? [
              { icon: <LanguageOutlinedIcon />, label: 'Website', value: sponsor.website ?? 'Not set' },
              { icon: <EmailOutlinedIcon />, label: 'Email', value: sponsor.email ?? 'Not set' },
              // Omitted entirely when the sponsor has no contacts of its own — same "each resolved
              // client-side by the caller... every one optional/absent omits its own row entirely"
              // pattern this codebase already uses for every other optional field.
              ...((sponsorContactsQuery.data ?? []).length > 0
                ? [
                    {
                      icon: <GroupsOutlinedIcon />,
                      label: 'Sponsor Contacts',
                      value: (
                        <Stack spacing={1}>
                          {(sponsorContactsQuery.data ?? []).map((sponsorContact) => (
                            <Box key={sponsorContact.id}>
                              <Typography variant="body2" fontWeight={600} component="div">
                                {sponsorContact.contact.firstName} {sponsorContact.contact.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {sponsorContact.role}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      ),
                    },
                  ]
                : []),
            ]
          : []
      }
      editTo={sponsor ? `/manage/sponsors/${sponsor.id}/edit` : '/manage/sponsors'}
    />
  )
}
