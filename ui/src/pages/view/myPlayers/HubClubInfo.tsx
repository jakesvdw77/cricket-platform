import { Alert, Box, Skeleton, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { useMyClubInfo } from '../../../api/meClubInfoApi'
import type { ClubInfoTabId } from '../../../api/meClubInfoApi'
import { creamAlpha } from '../../../brandTokens'
import { HubPageHeader } from './HubPageHeader'
import { HubTabBar, hubPanelId, hubTabId } from './HubTabBar'
import { HubClubAbout } from './HubClubAbout'
import { HubClubLinks } from './HubClubLinks'
import { HubClubDirectory } from './clubInfo/HubClubDirectory'
import { HUB, HUB_GROUND_SOLID } from './hubStyle'

// docs/specs/148 (Club info): the club's details for parents and players, read only. The server decides which pills exist (`tabs`);
// ?tab= picks one and an unknown value means the first visible pill. The footer owns Back.
const LABELS: Record<ClubInfoTabId, string> = { about: 'About', contacts: 'Contacts', links: 'Links' }
const PREFIX = 'hub-club-info'

export function HubClubInfo({ playerKey }: { playerKey?: string }) {
  const query = useMyClubInfo(playerKey)
  const [search, setSearch] = useSearchParams()
  const info = query.data

  let body
  if (query.isError) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => query.refetch()}>Retry</Button>}>
        We could not load the club details. Please try again.
      </Alert>
    )
  } else if (!info) {
    body = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }} aria-busy="true">
        <Skeleton variant="rounded" height={44} sx={{ bgcolor: creamAlpha(0.12) }} />
        <Skeleton variant="rounded" height={88} sx={{ bgcolor: creamAlpha(0.12) }} />
        <Skeleton variant="rounded" height={160} sx={{ bgcolor: creamAlpha(0.12) }} />
      </Box>
    )
  } else if (info.tabs.length === 0) {
    body = (
      <Box data-testid="club-info-empty" sx={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 1, border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 3 }}>
        <InfoOutlinedIcon aria-hidden sx={{ fontSize: 40, color: HUB.muted }} />
        <Typography component="h2" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.sand }}>Nothing to Show Yet</Typography>
        <Typography sx={{ color: HUB.muted }}>The club has not shared its details here yet. Check back soon.</Typography>
      </Box>
    )
  } else {
    const wanted = search.get('tab')
    const tab = (info.tabs.find((candidate) => candidate.id === wanted) ?? info.tabs[0]).id
    const counts: Partial<Record<ClubInfoTabId, number>> = {}
    for (const candidate of info.tabs) if (candidate.count !== null) counts[candidate.id] = candidate.count
    body = (
      <>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: HUB_GROUND_SOLID, borderBottom: `1px solid ${HUB.lineSoft}`, minWidth: 0 }}>
          <HubTabBar
            tabs={info.tabs.map((candidate) => ({ id: candidate.id, label: LABELS[candidate.id] }))}
            value={tab}
            counts={counts}
            ariaLabel="Club info sections"
            idPrefix={PREFIX}
            onChange={(next) => setSearch((current) => { const params = new URLSearchParams(current); params.set('tab', next); return params }, { replace: true })}
          />
        </Box>
        <Box role="tabpanel" id={hubPanelId(PREFIX, tab)} aria-labelledby={hubTabId(PREFIX, tab)} tabIndex={0} sx={{ outline: 'none', '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}>
          {tab === 'about' && <HubClubAbout info={info} />}
          {tab === 'contacts' && <HubClubDirectory playerKey={playerKey} directory={info.directory} />}
          {tab === 'links' && <HubClubLinks info={info} />}
        </Box>
      </>
    )
  }

  return (
    <Box data-testid="hub-club-info" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <HubPageHeader title="Club Info" context={info?.clubName ? <Typography noWrap sx={{ color: HUB.muted, fontSize: 16 }}>{info.clubName}</Typography> : undefined} />
      {body}
    </Box>
  )
}
