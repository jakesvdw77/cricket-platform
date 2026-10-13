import type { ReactNode } from 'react'
import { Box, Button as MuiButton } from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { InfoCard } from '../../../components/InfoCard'
import type { InfoCardField } from '../../../components/InfoCard'
import { countryName, provinceLabel } from '../../../utils/countries'
import { FIELD_CATEGORY_LABEL, FIELD_OWNER_TYPE_LABEL } from '../../../utils/fieldLabels'
import { FIELD_STATUS_LABEL, fieldStatusOf } from '../../../utils/fieldStatus'
import type { PlayingArea } from '../../../api/playingAreaApi'

const formatDate = (value: string | null | undefined): string | null =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null

export interface FieldInfoCardsProps {
  field: PlayingArea
  // The Details card's action (a manager's Add to our fields / Remove).
  detailsAction?: ReactNode
  // More fields on the Details card (the platform admin's linked clubs).
  extraDetails?: InfoCardField[]
  // More cards after the three (the platform admin's possible duplicates).
  extraCards?: ReactNode
}

// docs/specs/099-fields-directory.md (4): the equal-height InfoCards of a field's page - Address (with the Open in maps real
// outlined button, never a bare text link), Details and Verification. No Bookings or ground card: step 2 adds those in
// the same slot. Used by the manager's page and the platform admin's.
export function FieldInfoCards({ field, detailsAction, extraDetails = [], extraCards }: FieldInfoCardsProps) {
  const status = fieldStatusOf(field)
  const street = [field.address.number, field.address.street].filter(Boolean).join(' ')
  const verificationFields: InfoCardField[] = [
    { label: 'Status', value: FIELD_STATUS_LABEL[status] },
    { label: status === 'verified' ? 'Verified on' : 'Verified', value: status === 'verified' ? formatDate(field.verifiedAt) : null },
    ...(status === 'rejected' ? [{ label: 'Rejection reason', value: field.rejectionReason }] : []),
  ]

  return (
    <Box sx={{ display: 'grid', gap: { xs: 1.75, md: 2 }, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
      <InfoCard
        title="Address"
        icon={<PlaceOutlinedIcon />}
        fields={[
          { label: 'Street', value: street },
          { label: 'City', value: field.address.city },
          { label: provinceLabel(field.address.country), value: field.address.provinceState },
          { label: 'Postal code', value: field.address.postalCode },
          { label: 'Country', value: countryName(field.address.country) },
          { label: 'Location notes', value: field.locationNotes },
        ]}
        actions={
          field.mapUrl && (
            <MuiButton
              component="a"
              href={field.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<MapOutlinedIcon fontSize="small" />}
              sx={{ minHeight: { xs: 44, md: 34 } }}
            >
              Open in maps
            </MuiButton>
          )
        }
      />

      <InfoCard
        title="Details"
        icon={<GroupsOutlinedIcon />}
        fields={[
          { label: 'Type', value: FIELD_CATEGORY_LABEL[field.category] },
          { label: 'Owner type', value: FIELD_OWNER_TYPE_LABEL[field.ownerType] },
          { label: 'Owner', value: field.ownerName },
          { label: 'Captured by', value: field.createdByClubName },
          { label: 'Captured on', value: formatDate(field.createdAt) },
          { label: 'Clubs using it', value: field.linkedClubCount !== undefined ? String(field.linkedClubCount) : null },
          ...extraDetails,
        ]}
        actions={detailsAction}
      />

      <InfoCard
        title="Verification"
        icon={<ShieldOutlinedIcon />}
        fields={verificationFields}
      >
        {status === 'unverified' && (
          <Box component="p" sx={{ m: 0, typography: 'caption', color: 'text.secondary', lineHeight: 1.45 }}>
            While a field is unverified only the club that captured it can change it. Once verified, only a platform admin can.
          </Box>
        )}
      </InfoCard>

      {extraCards}
    </Box>
  )
}
