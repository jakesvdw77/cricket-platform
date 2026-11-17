import { Alert, Box, Skeleton, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Button } from '../../../components/Button'
import { useMyClubInfo, useMyTeamLinks } from '../../../api/meClubInfoApi'
import type { MyClubSocialLink } from '../../../api/meClubInfoApi'
import { creamAlpha } from '../../../brandTokens'
import { HubPageHeader } from './HubPageHeader'
import { describeLink } from './HubSocialLinks'
import { HUB } from './hubStyle'
import { isHttps } from './leagueFormat'

// The Hub's Social Media page: one large tappable card per social page the club added (the same links as Club info > Links, which the
// club's own switch controls). Every card opens the page in a new tab with rel="noopener noreferrer". Nothing is embedded: a link
// card works in every browser, where an embedded feed is blocked by many ad blockers and tracking protection.
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function SocialCard({ link }: { link: MyClubSocialLink }) {
  const { name, icon } = describeLink(link)
  return (
    <Box
      role="listitem"
      component="a"
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name}, ${hostOf(link.url)}, opens in a new tab`}
      data-testid="hub-social-card"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minHeight: 88,
        p: 2,
        color: HUB.cream,
        textDecoration: 'none',
        border: `1px solid ${HUB.line}`,
        borderRadius: '4px',
        bgcolor: creamAlpha(0.07),
        '&:hover': { bgcolor: creamAlpha(0.12), borderColor: HUB.gold },
        '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
      }}
    >
      <Box aria-hidden sx={{ display: 'grid', placeItems: 'center', width: 56, height: 56, flex: 'none', borderRadius: '50%', border: `1px solid ${HUB.line}`, color: HUB.gold, '& svg': { fontSize: 30 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 24, lineHeight: 1.1, letterSpacing: '0.03em' }}>{name}</Typography>
        <Typography noWrap sx={{ fontSize: 14, color: HUB.muted }}>{hostOf(link.url)}</Typography>
      </Box>
      <OpenInNewIcon aria-hidden sx={{ color: HUB.muted, flex: 'none' }} />
    </Box>
  )
}

const grid = { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } } as const

// One group of cards behind a heading (the club, then each team the player is in).
function LinkGroup({ title, links, testId }: { title?: string; links: MyClubSocialLink[]; testId: string }) {
  return (
    <Box component="section" aria-label={title ?? 'Club'} data-testid={testId} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }}>
      {title && <Typography component="h3" sx={{ fontFamily: HUB.display, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 15, color: HUB.sand, m: 0 }}>{title}</Typography>}
      <Box role="list" sx={grid}>
        {links.map((link) => <SocialCard key={`${link.platform}-${link.url}`} link={link} />)}
      </Box>
    </Box>
  )
}

export function HubSocial({ playerKey }: { playerKey?: string }) {
  const info = useMyClubInfo(playerKey)
  const teams = useMyTeamLinks(playerKey)
  const clubLinks = (info.data?.links?.social ?? []).filter((link) => isHttps(link.url))
  const teamGroups = (teams.data ?? [])
    .map((team) => ({ name: team.teamName, links: team.social.filter((link) => isHttps(link.url)) }))
    .filter((team) => team.links.length > 0)

  let body
  if (info.isLoading) {
    body = (
      <Box sx={grid}>
        {[0, 1].map((n) => <Skeleton key={n} variant="rounded" height={96} sx={{ bgcolor: creamAlpha(0.12) }} />)}
      </Box>
    )
  } else if (info.isError) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => info.refetch()}>Retry</Button>}>
        We could not load the club's social media pages. Please try again.
      </Alert>
    )
  } else if (clubLinks.length === 0 && teamGroups.length === 0) {
    body = (
      <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, color: HUB.muted }}>
        The club has not added any social media pages yet.
      </Box>
    )
  } else {
    body = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2.5 }}>
        {clubLinks.length > 0 && <LinkGroup title={teamGroups.length > 0 ? info.data?.clubName : undefined} links={clubLinks} testId="hub-social-club" />}
        {teamGroups.map((team) => <LinkGroup key={team.name} title={team.name} links={team.links} testId="hub-social-team" />)}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <HubPageHeader title="Social Media" />
      {body}
    </Box>
  )
}
