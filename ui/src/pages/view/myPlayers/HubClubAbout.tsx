import type { ReactNode } from 'react'
import { Box, Link } from '@mui/material'
import CallOutlinedIcon from '@mui/icons-material/CallOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import type { ClubProfileType } from '../../../api/clubApi'
import type { MyClubInfo } from '../../../api/meClubInfoApi'
import { Fact, FactsCard } from './HubFacts'
import { HubIconLink, HubSocialIconRow } from './HubSocialLinks'
import { HubClubImages } from './HubClubImages'
import { HUB } from './hubStyle'
import { addressLines, emailHref, mapsUrl, phoneHref } from './clubInfo/clubInfoFormat'

// docs/specs/148 (About): the images, then the club details card (Type, Address, Phone, Email; a fact with no value is omitted) and
// the social icon row. Values come from the server, which has already applied the club's switches.
const TYPE_LABELS: Record<ClubProfileType, string> = { CLUB: 'Club', ACADEMY: 'Academy', SCHOOL: 'School', OTHER: 'Other' }
const valueLink = { color: HUB.cream, textDecorationColor: HUB.line, overflowWrap: 'anywhere' } as const

export function HubClubAbout({ info }: { info: MyClubInfo }) {
  const { about, logos, links } = info
  const lines = addressLines(about?.address)
  const maps = mapsUrl(lines)
  const tel = phoneHref(about?.phone)
  const mail = emailHref(about?.email)
  const facts: { label: string; value: ReactNode; action?: ReactNode }[] = []
  if (about?.type) facts.push({ label: 'Type', value: TYPE_LABELS[about.type] ?? about.type })
  if (lines.length > 0) {
    facts.push({
      label: 'Address',
      value: lines.map((line) => <Box key={line} component="span" sx={{ display: 'block' }}>{line}</Box>),
      action: maps ? <HubIconLink href={maps} label="Open In Maps" icon={<MapOutlinedIcon />} external /> : undefined,
    })
  }
  if (about?.phone) {
    facts.push({
      label: 'Phone',
      value: tel ? <Link href={tel} sx={valueLink}>{about.phone}</Link> : about.phone,
      action: tel ? <HubIconLink href={tel} label="Call" icon={<CallOutlinedIcon />} /> : undefined,
    })
  }
  if (about?.email) {
    facts.push({
      label: 'Email',
      value: mail ? <Link href={mail} sx={valueLink}>{about.email}</Link> : about.email,
      action: mail ? <HubIconLink href={mail} label="Email" icon={<EmailOutlinedIcon />} /> : undefined,
    })
  }
  const socials = [...(links?.website ? [{ platform: 'Website', url: links.website }] : []), ...(links?.social ?? [])]
  return (
    <Box data-testid="hub-club-about" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <HubClubImages clubName={info.clubName} logos={logos} trailing={<HubSocialIconRow links={socials} ownerLabel={info.clubName} justify="flex-end" />} />
      {facts.length > 0 && (
        <FactsCard title="Club Details" testId="club-facts">
          {facts.map((fact, index) => <Fact key={fact.label} label={fact.label} value={fact.value} action={fact.action} last={index >= facts.length - (facts.length % 2 === 0 ? 2 : 1)} />)}
        </FactsCard>
      )}
    </Box>
  )
}
