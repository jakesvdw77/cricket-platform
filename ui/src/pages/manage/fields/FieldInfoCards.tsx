import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { InfoCard } from '../../../components/InfoCard'
import type { InfoCardField } from '../../../components/InfoCard'
import { countryName, provinceLabel } from '../../../utils/countries'
import { FIELD_CATEGORY_LABEL, FIELD_OWNER_TYPE_LABEL } from '../../../utils/fieldLabels'
import { FIELD_STATUS_LABEL, fieldStatusOf } from '../../../utils/fieldStatus'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { useFieldLocation } from '../../../hooks/useFieldLocation'
import { coordinateText } from '../../../utils/fieldForm'
import { storedPoint } from '../../../utils/fieldLocation'

const pairText = (lat: number | null | undefined, lng: number | null | undefined): string | null =>
  storedPoint(lat, lng) ? `${coordinateText(lat)}, ${coordinateText(lng)}` : null

const formatDate = (value: string | null | undefined): string | null =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null

export interface FieldInfoCardsProps {
  field: PlayingArea
  // More fields on the Details card (the platform admin's linked clubs).
  extraDetails?: InfoCardField[]
  // More cards after the three (the platform admin's possible duplicates).
  extraCards?: ReactNode
}

// docs/specs/099-fields-directory.md (4) and docs/specs/134: the equal-height flat InfoCards (hairline, no shadow) of a field's page -
// Address, Details and Verification. Open in maps, Add To Our Fields and the status actions are items of the Manage Field menu, so
// no card carries a button. No Bookings or ground card: step 2 adds those in the same slot. Used by the manager's page and the
// platform admin's.
export function FieldInfoCards({ field, extraDetails = [], extraCards }: FieldInfoCardsProps) {
  const status = fieldStatusOf(field)
  const location = useFieldLocation(field)
  const street = [field.address.number, field.address.street].filter(Boolean).join(' ')
  const verificationFields: InfoCardField[] = [
    { label: 'Status', value: FIELD_STATUS_LABEL[status] },
    { label: status === 'verified' ? 'Verified on' : 'Verified', value: status === 'verified' ? formatDate(field.verifiedAt) : null },
    ...(status === 'rejected' ? [{ label: 'Rejection reason', value: field.rejectionReason }] : []),
  ]

  return (
    <Box sx={{ display: 'grid', gap: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
      <InfoCard
        flat
        title="Address"
        icon={<PlaceOutlinedIcon />}
        fields={[
          { label: 'Street', value: street },
          { label: 'City', value: field.address.city },
          { label: provinceLabel(field.address.country), value: field.address.provinceState },
          { label: 'Postal code', value: field.address.postalCode },
          { label: 'Country', value: countryName(field.address.country) },
          { label: 'Location notes', value: field.locationNotes },
          { label: 'Coordinates', value: pairText(field.latitude, field.longitude) },
          { label: 'Entrance or parking', value: pairText(field.accessLatitude, field.accessLongitude) },
          { label: 'Access note', value: field.accessNote },
        ]}
      >
        {location.source === 'TOWN' && (
          <Box component="p" data-testid="field-approximate-note" sx={{ m: 0, typography: 'caption', color: 'text.secondary', lineHeight: 1.45 }}>
            Approximate: no coordinates are stored, so the town centre is used for the forecast and directions.
          </Box>
        )}
      </InfoCard>

      <InfoCard
        flat
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
      />

      <InfoCard
        flat
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
