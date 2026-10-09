import { useState } from 'react'
import type { ReactNode } from 'react'
import { Avatar, Box, ButtonBase, Stack, Typography } from '@mui/material'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { avatarSx, RecordCard } from '../RecordCard'
import type { RecordCardBadge } from '../RecordCard'
import { DetailLine } from '../DetailLine'
import { KeyFigureTile } from '../KeyFigureTile'
import { SocialLinksRow } from '../marketing/SocialLinksRow'
import { SponsorQuickViewDialog } from '../SponsorQuickViewDialog'
import { initialsFromName } from '../../utils/initials'
import { zebraTint } from '../../utils/zebraTint'
import type { Team } from '../../api/teamApi'
import type { Sponsor } from '../../api/sponsorApi'

export interface TeamCardProps {
  team: Team
  // The leaf section's own name (not the full breadcrumb).
  sectionName: string
  // Each resolved client-side by the caller (the Teams page); null / absent shows a muted "–".
  captainName?: string | null
  managerName?: string | null
  coachName?: string | null
  playerCount: number
  matchCount: number
  sponsors?: Sponsor[]
  viewTo: string
  editTo: string
  // The footer's Squad and Matches destinations; both default to the team page (the squad is on it, and the Matches list
  // has no team address to open on).
  squadTo?: string
  matchesTo?: string
}

const NOT_ON_FILE = '–'

function PersonRow({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  return (
    <Box data-testid="team-detail-row" sx={{ p: 1, borderRadius: 0.75, '&:nth-of-type(odd)': { bgcolor: zebraTint } }}>
      <DetailLine icon={icon} label={label} labelWidth={72} value={value || NOT_ON_FILE} muted={!value} />
    </Box>
  )
}

// docs/specs/092-teams-gold-standard.md (B), mockup board 2b: one RecordCard per team, built like the player, match and
// league cards - the logo and name with the section and Active / Inactive chips beneath, the social icons in the corner,
// Players and Matches figure tiles, zebra Captain / Manager / Coach rows ("–" muted when empty), a Sponsors row (each logo
// opens the quick-view dialog) and an icon-over-caption footer (Squad, Matches, Edit). The whole card opens the team.
export function TeamCard({
  team,
  sectionName,
  captainName,
  managerName,
  coachName,
  playerCount,
  matchCount,
  sponsors = [],
  viewTo,
  editTo,
  squadTo,
  matchesTo,
}: TeamCardProps) {
  const socialLinks = team.socialLinks ?? []
  const [openSponsorId, setOpenSponsorId] = useState<string | null>(null)
  const selectedSponsor = sponsors.find((sponsor) => sponsor.id === openSponsorId) ?? null
  const badges: RecordCardBadge[] = [
    { label: sectionName, tone: 'neutral' },
    team.active ? { label: 'Active', tone: 'active' } : { label: 'Inactive', tone: 'muted' },
  ]

  return (
    <>
      <RecordCard
        title={team.name}
        titleWrap
        badgesBelow
        avatar={{ imageUrl: team.logoUrl, fallback: initialsFromName(team.name), shape: 'rounded' }}
        badges={badges}
        // position: relative paints the links above the card's stretched link (059).
        headerActions={
          socialLinks.length > 0 ? (
            <Box data-testid="team-social-links" sx={{ position: 'relative' }}>
              <SocialLinksRow links={socialLinks} size="small" />
            </Box>
          ) : undefined
        }
        viewTo={viewTo}
        footerButtons={[
          { label: 'Squad', icon: <GroupsOutlinedIcon fontSize="small" />, to: squadTo ?? viewTo },
          { label: 'Matches', icon: <EventOutlinedIcon fontSize="small" />, to: matchesTo ?? viewTo },
          { label: 'Edit', icon: <EditOutlinedIcon fontSize="small" />, to: editTo },
        ]}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
          <KeyFigureTile testId="team-players" icon={<GroupsOutlinedIcon fontSize="small" />} value={playerCount} label="Players" />
          <KeyFigureTile testId="team-matches" icon={<EventOutlinedIcon fontSize="small" />} value={matchCount} label="Matches" />
        </Box>

        {/* The same three rows on every card; the margin lets the zebra tint bleed to the card padding's edge. */}
        <Stack sx={{ mx: -1 }}>
          <PersonRow icon={<MilitaryTechOutlinedIcon fontSize="small" />} label="Captain" value={captainName} />
          <PersonRow icon={<BadgeOutlinedIcon fontSize="small" />} label="Manager" value={managerName} />
          <PersonRow icon={<SportsCricketOutlinedIcon fontSize="small" />} label="Coach" value={coachName} />
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minHeight: 32 }} data-testid="team-sponsors">
          <Typography variant="body2" fontWeight={700} component="h4">
            Sponsors
          </Typography>
          {sponsors.length > 0 ? (
            // position: relative lifts these buttons above the card's stretched link (059), as the footer is.
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ position: 'relative' }}>
              {sponsors.map((sponsor) => (
                <ButtonBase
                  key={sponsor.id}
                  onClick={() => setOpenSponsorId(sponsor.id)}
                  title={sponsor.name}
                  aria-label={`${sponsor.name} — Sponsor`}
                  sx={{ borderRadius: 1 }}
                >
                  <Avatar src={sponsor.logoUrl ?? undefined} variant="rounded" sx={avatarSx(28, '0.6875rem')}>
                    {initialsFromName(sponsor.name)}
                  </Avatar>
                </ButtonBase>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No sponsors
            </Typography>
          )}
        </Stack>
      </RecordCard>

      <SponsorQuickViewDialog clubId={team.clubId} sponsor={selectedSponsor} onClose={() => setOpenSponsorId(null)} />
    </>
  )
}
