import type { ReactNode } from 'react'
import { Box, Link as MuiLink, Stack } from '@mui/material'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { DetailLine } from '../DetailLine'
import { RecordCard } from '../RecordCard'
import type { RecordCardBadge } from '../RecordCard'
import { initialsFromName } from '../../utils/initials'
import { countryName } from '../../utils/countries'
import { cityLine, FIELD_CATEGORY_LABEL } from '../../utils/fieldLabels'
import { fieldStatusBadge, fieldStatusOf } from '../../utils/fieldStatus'
import { NOT_ON_FILE } from '../../utils/playerFormat'
import { zebraTint } from '../../utils/zebraTint'
import type { PlayingArea } from '../../api/playingAreaApi'

export interface FieldCardProps {
  field: PlayingArea
  // The field page, already carrying its returnTo (the whole card is one stretched link).
  viewTo: string
  // The platform admin's card: the body gains rows for who captured the field, the clubs using it and any possible duplicates,
  // and the "Our field" badge is left out.
  admin?: boolean
  // The card's ONE actions button (the page's FieldRowMenu kebab), top right.
  actions?: ReactNode
}

const FIELD_LABEL_WIDTH = 68

// The whole card is one stretched link; a value that is a link itself sits above it.
const inlineLinkSx = { position: 'relative', fontWeight: 600 } as const

function DetailRow({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: ReactNode; muted?: boolean }) {
  return (
    <Box data-testid="field-detail-row" sx={{ p: 1, borderRadius: 0.75, '&:nth-of-type(odd)': { bgcolor: zebraTint } }}>
      <DetailLine icon={icon} label={label} value={value} muted={muted} labelWidth={FIELD_LABEL_WIDTH} />
    </Box>
  )
}

// docs/specs/099 and docs/specs/134: the Field card on RecordCard's flat look (hairline, hover lift, no footer bar) and its one rule -
// every card has the same parts and the same height whatever the field's status. The rounded avatar with the name clamped to two
// lines and the page's one kebab top right; one badge row (the verification badge first, then the Type and "Our field" or a dashed
// "Not our field"); zebra rows that always render and show "-" when empty (Owner, City, Country, Matches, Map). The platform
// admin's variant swaps Matches for Captured and Clubs and adds Similar.
export function FieldCard({ field, viewTo, admin = false, actions }: FieldCardProps) {
  const status = fieldStatusOf(field)
  const city = cityLine(field)
  const country = countryName(field.address.country)
  const linkedHome = Boolean(field.linkedHome)
  const similar = (field.possibleDuplicates ?? []).map((duplicate) => duplicate.name).join(', ')
  const badges: RecordCardBadge[] = [
    fieldStatusBadge(status),
    { label: FIELD_CATEGORY_LABEL[field.category], tone: 'neutral' },
    ...(admin ? [] : [linkedHome ? ({ label: 'Our field', tone: 'active' } as const) : ({ label: 'Not our field', tone: 'noPoll' } as const)]),
  ]

  return (
    <RecordCard
      flat
      title={field.name}
      titleWrap
      badgesBelow
      avatar={{ fallback: initialsFromName(field.name), shape: 'rounded' }}
      badges={badges}
      headerActions={actions}
      viewTo={viewTo}
      // No footer action bar (page-anatomy section 6): the kebab in the corner holds every action.
      footerActions={null}
    >
      {/* The same rows on every card; the margin lets the zebra tint bleed to the card padding's edge. */}
      <Stack sx={{ mx: -1 }}>
        <DetailRow icon={<StorefrontOutlinedIcon fontSize="small" />} label="Owner" value={field.ownerName || NOT_ON_FILE} muted={!field.ownerName} />
        <DetailRow icon={<PlaceOutlinedIcon fontSize="small" />} label="City" value={city || NOT_ON_FILE} muted={!city} />
        <DetailRow icon={<LanguageOutlinedIcon fontSize="small" />} label="Country" value={country || NOT_ON_FILE} muted={!country} />
        {admin ? (
          <>
            <DetailRow
              icon={<PersonOutlineIcon fontSize="small" />}
              label="Captured"
              value={field.createdByClubName || NOT_ON_FILE}
              muted={!field.createdByClubName}
            />
            <DetailRow
              icon={<GroupsOutlinedIcon fontSize="small" />}
              label="Clubs"
              value={`${field.linkedClubCount ?? 0} ${(field.linkedClubCount ?? 0) === 1 ? 'club' : 'clubs'} · ${field.matchCount ?? 0} ${(field.matchCount ?? 0) === 1 ? 'match' : 'matches'}`}
            />
          </>
        ) : (
          <DetailRow icon={<EventOutlinedIcon fontSize="small" />} label="Matches" value={String(field.matchCount ?? 0)} />
        )}
        <DetailRow
          icon={<MapOutlinedIcon fontSize="small" />}
          label="Map"
          muted={!field.mapUrl}
          value={
            field.mapUrl ? (
              <MuiLink href={field.mapUrl} target="_blank" rel="noopener noreferrer" underline="hover" sx={inlineLinkSx}>
                Open in maps
              </MuiLink>
            ) : (
              NOT_ON_FILE
            )
          }
        />
        {admin && <DetailRow icon={<FlagOutlinedIcon fontSize="small" />} label="Similar" value={similar || NOT_ON_FILE} muted={!similar} />}
      </Stack>
    </RecordCard>
  )
}
