import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { EmptyState } from '../../components/EmptyState'
import { listClubContacts } from '../../api/clubContactApi'
import { initialsFromName } from '../../utils/initials'
import { badgeFor, fullName } from './ClubContactList'

// docs/specs/036-view-first-record-detail-screens.md: the read-only counterpart to
// ClubContactFormPage.tsx — same data-fetch shape (list + find-by-id, no single-contact GET
// exists), same badgeFor/fullName mapping (imported from ClubContactList.tsx, not duplicated).
// One un-headed section, since Club Contact was already untabbed on its edit form.
export default function ClubContactDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { id } = useParams<{ id?: string }>()

  const {
    data: contact,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'contacts'],
    queryFn: () => listClubContacts(clubId as string),
    enabled: Boolean(clubId),
    select: (contacts) => contacts.find((candidate) => candidate.id === id),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
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
      backTo="/manage/club-contacts"
      backLabel="Back to Contacts"
      avatar={{ imageUrl: contact.photoUrl, fallback: initialsFromName(fullName(contact)), shape: 'circular' }}
      badge={badgeFor(contact)}
      editTo={`/manage/club-contacts/${contact.id}/edit`}
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
