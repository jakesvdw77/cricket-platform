import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  Avatar,
  Box,
  ButtonBase,
  Card as MuiCard,
  CardActions,
  CardContent,
  Chip,
  Link as MuiLink,
  Stack,
  Typography,
  Button as MuiButton,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link as RouterLink } from 'react-router-dom'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined'
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { badgeSx } from '../RecordCard'
import type { RecordCardBadge } from '../RecordCard'
import { SocialLinksRow } from '../marketing/SocialLinksRow'
import { SponsorQuickViewDialog } from '../SponsorQuickViewDialog'
import { initialsFromName } from '../../utils/initials'
import type { Team } from '../../api/teamApi'
import type { Sponsor } from '../../api/sponsorApi'

export interface TeamCardProps {
  team: Team
  // The leaf section's own name (not the full breadcrumb) — docs/specs/057-team-extended-profile.md's
  // UI Requirements: "Detailed adds a second descriptive chip here, e.g. the leaf section's own
  // name, alongside abbreviation."
  sectionName: string
  badge?: RecordCardBadge
  // Each resolved client-side by the caller (TeamDirectory/TeamList) — every one optional/absent
  // omits its own row entirely, no error, no empty icon (the spec's Acceptance Criteria).
  captainName?: string | null
  managerName?: string | null
  coachName?: string | null
  playerCount: number
  matchCount: number
  sponsors?: Sponsor[]
  viewTo: string
  editTo: string
}

// One icon+label row, omitted entirely by the caller when its value is absent — mirrors
// RecordDetailScreen's DetailFieldRow visually (icon + caption + value) but deliberately kept
// local rather than imported: this card's rows are single-line, not a two-column field grid.
function IconRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', '& svg': { fontSize: 18 } }}>
        {icon}
      </Box>
      <Typography variant="body2" color="text.secondary" noWrap>
        <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
          {label}:
        </Box>{' '}
        {value}
      </Typography>
    </Stack>
  )
}

// The shared "Detailed" density card for a Team — docs/specs/057-team-extended-profile.md's
// approved design-canvas mockup. Both TeamDirectory.tsx and TeamList.tsx previously each declared
// a near-identical, much simpler `TeamCard` function; this is the one shared implementation both
// now use instead. A bespoke card body (not a RecordCard retrofit — RecordCard.fields has no icon
// slot, and giving every RecordCard consumer an icon-row option is a larger blast radius than this
// spec's own scope), but mirrors RecordCard's outer shell (avatar, title, badge, footer actions)
// exactly, same "bespoke page, shared shell" posture 056's ClubOverviewPage already established.
export function TeamCard({
  team,
  sectionName,
  badge,
  captainName,
  managerName,
  coachName,
  playerCount,
  matchCount,
  sponsors = [],
  viewTo,
  editTo,
}: TeamCardProps) {
  const socialLinks = team.socialLinks ?? []
  const [openSponsorId, setOpenSponsorId] = useState<string | null>(null)
  const selectedSponsor = sponsors.find((sponsor) => sponsor.id === openSponsorId) ?? null

  return (
    // height: '100%' + column flex — same fix RecordCard.tsx applies, per direct user feedback:
    // a row of these cards sits in a CSS grid (whose default align-items: stretch already equalizes
    // each card's outer height to the row's tallest), but without this the footer just trailed the
    // content instead of occupying that stretched space, leaving View/Edit at different vertical
    // positions across cards with different amounts of optional content (Ground/Captain/Manager/
    // Coach rows). flex: '1 1 auto' on CardContent grows to fill it, pinning CardActions to the
    // bottom.
    //
    // position: relative + hover halo mirror RecordCard.tsx's own click-to-view treatment
    // (docs/specs/059-record-card-click-to-view.md) — real user feedback that this bespoke
    // shell should behave identically to RecordCard, not just look like it.
    <MuiCard
      sx={{
        bgcolor: 'background.paper',
        boxShadow: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'box-shadow 0.15s ease, outline-color 0.15s ease',
        outline: '1px solid transparent',
        '&:hover': { boxShadow: 6, outlineColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: '1 1 auto' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Avatar
              src={team.logoUrl ?? undefined}
              variant="rounded"
              sx={{
                width: 40,
                height: 40,
                flex: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                color: 'primary.dark',
              }}
            >
              {initialsFromName(team.name)}
            </Avatar>
            <Typography variant="subtitle1" component="h3" fontWeight={600} noWrap>
              {/* Stretched-link title, same pattern as RecordCard.tsx: the link stays
                  position: static (default) so its ::after resolves its containing block
                  to MuiCard above, not to itself — see 059's spec for why. */}
              <MuiLink component={RouterLink} to={viewTo} color="inherit" underline="none" sx={{ '&::after': { content: '""', position: 'absolute', inset: 0 } }}>
                {team.name}
              </MuiLink>
            </Typography>
          </Stack>
          {/* Badge + social links share the top-right corner — real user feedback that social
              icons buried near the bottom (after sponsors) read as an afterthought; moving them
              up here, alongside the badge, surfaces them without adding a dedicated row.
              position: relative is the same stretched-link stacking-order fix SocialLinksRow
              gets everywhere else on this card — see the CardActions comment below. */}
          {(badge || socialLinks.length > 0) && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 'none', position: 'relative' }}>
              {badge && (
                <Chip size="small" label={badge.label} variant={badge.tone === 'neutral' ? 'outlined' : 'filled'} sx={badgeSx(badge.tone)} />
              )}
              {socialLinks.length > 0 && <SocialLinksRow links={socialLinks} size="small" />}
            </Stack>
          )}
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {team.abbreviation && <Chip size="small" variant="outlined" label={team.abbreviation} />}
          <Chip size="small" variant="outlined" label={sectionName} />
        </Stack>

        <Stack spacing={0.75}>
          {team.groundName && <IconRow icon={<PlaceOutlinedIcon />} label="Ground" value={team.groundName} />}
          {captainName && <IconRow icon={<MilitaryTechOutlinedIcon />} label="Captain" value={captainName} />}
          {managerName && <IconRow icon={<BadgeOutlinedIcon />} label="Manager" value={managerName} />}
          {coachName && <IconRow icon={<SportsCricketOutlinedIcon />} label="Coach" value={coachName} />}
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip size="small" icon={<GroupsOutlinedIcon />} label={`${playerCount} players`} sx={{ '& .MuiChip-icon': { ml: 0.75 } }} />
          <Chip size="small" icon={<EventOutlinedIcon />} label={`${matchCount} matches`} sx={{ '& .MuiChip-icon': { ml: 0.75 } }} />
        </Stack>

        {sponsors.length > 0 && (
          // position: relative — same stacking-order fix CardActions gets below: without it the
          // stretched-link title overlay silently swallows clicks on these buttons.
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ position: 'relative' }}>
            {sponsors.map((sponsor) => (
              <ButtonBase
                key={sponsor.id}
                onClick={() => setOpenSponsorId(sponsor.id)}
                title={sponsor.name}
                aria-label={`${sponsor.name} — Sponsor`}
                sx={{ borderRadius: 1 }}
              >
                <Avatar
                  src={sponsor.logoUrl ?? undefined}
                  variant="rounded"
                  sx={{
                    width: 28,
                    height: 28,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.dark',
                  }}
                >
                  {initialsFromName(sponsor.name)}
                </Avatar>
              </ButtonBase>
            ))}
          </Stack>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', px: 2, pb: 2, pt: 0, position: 'relative' }}>
        <MuiButton
          component={RouterLink}
          to={editTo}
          variant="text"
          color="inherit"
          size="small"
          startIcon={<EditOutlinedIcon fontSize="small" />}
        >
          Edit
        </MuiButton>
      </CardActions>

      <SponsorQuickViewDialog clubId={team.clubId} sponsor={selectedSponsor} onClose={() => setOpenSponsorId(null)} />
    </MuiCard>
  )
}
