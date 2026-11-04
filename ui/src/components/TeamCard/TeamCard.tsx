import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogoAvatar } from '../LogoAvatar'
import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import type { ReactNode } from 'react'
import { RecordCard } from '../RecordCard'
import type { RecordCardBadge } from '../RecordCard'
import { DetailLine } from '../DetailLine'
import { Button } from '../Button'
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
  // Already carries returnTo (the list adds it).
  viewTo: string
  // docs/specs/142 (owner): View Stats is used often, so it stays a button on the card (it is also in the kebab); already carries returnTo.
  statsTo: string
  // The ONE kebab (a `TeamActionsMenu`), top right beside the social links.
  menu?: ReactNode
}

const NOT_ON_FILE = '–'

function PersonRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Box data-testid="team-detail-row" sx={{ p: 1, borderRadius: 0.75, '&:nth-of-type(odd)': { bgcolor: zebraTint } }}>
      <DetailLine label={label} labelWidth={72} value={value === 0 || value ? value : NOT_ON_FILE} muted={value !== 0 && !value} />
    </Box>
  )
}

// docs/specs/092-teams-gold-standard.md (B), mockup board 2b: one RecordCard per team, built like the player, match and
// league cards - the logo and name with the section and Active / Inactive chips beneath, the social icons in the corner,
// Players and Matches figure tiles, zebra Captain / Manager / Coach rows ("–" muted when empty), a Sponsors row (each logo
// opens the quick-view dialog) and an icon-over-caption footer (Squad, Matches, Edit, Stats). The whole card opens the team.
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
  statsTo,
  menu,
}: TeamCardProps) {
  const navigate = useNavigate()
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
        // position: relative paints the links and the kebab above the card's stretched link (059).
        headerActions={
          socialLinks.length > 0 || menu ? (
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {socialLinks.length > 0 && (
                <Box data-testid="team-social-links">
                  <SocialLinksRow links={socialLinks} size="small" />
                </Box>
              )}
              {menu}
            </Box>
          ) : undefined
        }
        viewTo={viewTo}
        // No footer bar (page-anatomy section 6): the kebab holds every action and View Stats is the one quick button below.
        footerActions={null}
        flat
      >
        {/* The same five rows on every card (no icons); the margin lets the zebra tint bleed to the card padding's edge. */}
        <Stack sx={{ mx: -1 }}>
          <PersonRow label="Players" value={playerCount} />
          <PersonRow label="Matches" value={matchCount} />
          <PersonRow label="Captain" value={captainName} />
          <PersonRow label="Manager" value={managerName} />
          <PersonRow label="Coach" value={coachName} />
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
                  <LogoAvatar src={sponsor.logoUrl} variant="rounded" size={28} fontSize="0.6875rem">
                    {initialsFromName(sponsor.name)}
                  </LogoAvatar>
                </ButtonBase>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No sponsors
            </Typography>
          )}
        </Stack>

        {/* The one frequent action stays a click away, lifted above the stretched link; every card has the row so heights match. */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
          <Button size="compact" variant="secondary" startIcon={<EqualizerOutlinedIcon />} onClick={() => navigate(statsTo)} data-testid="team-card-stats">
            View Stats
          </Button>
        </Box>
      </RecordCard>

      <SponsorQuickViewDialog clubId={team.clubId} sponsor={selectedSponsor} onClose={() => setOpenSponsorId(null)} />
    </>
  )
}
