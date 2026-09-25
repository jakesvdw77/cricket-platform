import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { EmptyState } from '../../components/EmptyState'
import { listLeagueContacts } from '../../api/leagueContactApi'
import { initialsFromName } from '../../utils/initials'
import { badgeFor, fullName } from '../../utils/leagueContact'

// docs/specs/036-view-first-record-detail-screens.md: the read-only counterpart to
// LeagueContactFormPage.tsx — same data-fetch shape (list + find-by-id, no single-contact GET
// exists), same badgeFor/fullName mapping (imported from ui/src/utils/leagueContact.ts, not
// duplicated). One un-headed section, same shape as SponsorContactDetailPage. Back link goes to
// this league's own read-only detail screen.
export default function LeagueContactDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId, contactId } = useParams<{ leagueId: string; contactId?: string }>()

  const {
    data: contact,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'],
    queryFn: () => listLeagueContacts(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId),
    select: (contacts) => contacts.find((candidate) => candidate.id === contactId),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (!leagueId) {
    return <EmptyState title="Not found" description="No league was specified." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !contact) {
    return (
      <EmptyState
        title="Couldn't load this contact"
        description="Something went wrong loading this contact. Please try again."
      />
    )
  }

  return (
    <RecordDetailScreen
      title={fullName(contact)}
      backTo={`/manage/fixtures/leagues/${leagueId}`}
      backLabel="Back to League"
      avatar={{ fallback: initialsFromName(fullName(contact)), shape: 'circular' }}
      badge={badgeFor(contact)}
      editTo={`/manage/fixtures/leagues/${leagueId}/contacts/${contact.id}/edit`}
      sections={[
        {
          content: (
            <DetailFieldGrid>
              <DetailFieldRow icon={<BadgeOutlinedIcon />} label="Role" value={contact.role} />
              <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value={contact.contact.email} />
              <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value={contact.contact.phone} />
              <DetailFieldRow
                icon={<StarBorderOutlinedIcon />}
                label="Primary contact"
                value={contact.isPrimary ? 'Yes' : 'No'}
              />
            </DetailFieldGrid>
          ),
        },
      ]}
    />
  )
}
