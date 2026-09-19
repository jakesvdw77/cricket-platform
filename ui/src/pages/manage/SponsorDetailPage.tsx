import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { EmptyState } from '../../components/EmptyState'
import { SocialLinksRow } from '../../components/marketing/SocialLinksRow'
import { listSponsors } from '../../api/sponsorApi'
import { initialsFromName } from '../../utils/initials'
import { badgeFor } from './SponsorList'

// docs/specs/036-view-first-record-detail-screens.md's Sponsor decision (per the plan's own
// "Implementation-level decision" note): Sponsor uses the exact same shared RecordDetailScreen
// header as every other entity (Back/avatar/title/badge/Edit) — its one section has no heading and
// its content is a bordered/tinted card of icon-prefixed contact fields, with social links as
// small circular icon buttons anchored to the card's bottom-right corner. It does NOT repeat the
// logo/name inside that card, since the shared header above it already shows them.
export default function SponsorDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { id } = useParams<{ id?: string }>()

  const {
    data: sponsor,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors'],
    queryFn: () => listSponsors(clubId as string),
    enabled: Boolean(clubId),
    select: (sponsors) => sponsors.find((candidate) => candidate.id === id),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !sponsor) {
    return (
      <EmptyState
        title="Couldn't load this sponsor"
        description="Something went wrong loading this sponsor. Please try again."
      />
    )
  }

  const hasSocialLinks = sponsor.socialLinks.length > 0
  const hasAnyContactField = Boolean(sponsor.phone || sponsor.email || sponsor.website)

  return (
    <RecordDetailScreen
      title={sponsor.name}
      backTo="/manage/sponsors"
      backLabel="Back to Sponsors"
      avatar={{ imageUrl: sponsor.logoUrl, fallback: initialsFromName(sponsor.name), shape: 'rounded' }}
      badge={badgeFor(sponsor)}
      editTo={`/manage/sponsors/${sponsor.id}/edit`}
      sections={[
        {
          content: !hasAnyContactField && !hasSocialLinks ? (
            <EmptyState title="No contact details yet" description="Add a phone, email, website, or social link from Edit." />
          ) : (
            <Box
              sx={{
                position: 'relative',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                p: 3,
                pb: hasSocialLinks ? 7 : 3,
              }}
            >
              <DetailFieldGrid>
                {sponsor.phone && <DetailFieldRow icon={<PhoneOutlinedIcon />} label="Phone" value={sponsor.phone} />}
                {sponsor.email && <DetailFieldRow icon={<EmailOutlinedIcon />} label="Email" value={sponsor.email} />}
                {sponsor.website && (
                  <DetailFieldRow icon={<LanguageOutlinedIcon />} label="Website" value={sponsor.website} />
                )}
              </DetailFieldGrid>

              {hasSocialLinks && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 12,
                    bottom: 12,
                    '& .MuiIconButton-root': {
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: '50%',
                      bgcolor: 'background.paper',
                    },
                  }}
                >
                  <SocialLinksRow links={sponsor.socialLinks} />
                </Box>
              )}
            </Box>
          ),
        },
      ]}
    />
  )
}
