import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Skeleton, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MyLinkRequests } from './MyLinkRequests'
import { InvitationsList } from './MyInvitationsPage'
import { useMyInvitations, useMyLinkRequests } from '../../api/meApi'
import { useMyPlayer, useMyPlayerPolls, useMyPlayers } from '../../api/myPlayersApi'
import { HubFooterButton, HubFrame } from './myPlayers/HubFrame'
import { EditAgentsView, RemoveLinkView } from './myPlayers/AgentViews'
import { MyPlayerEditForm } from './myPlayers/MyPlayerEditForm'
import type { EditSection } from './myPlayers/MyPlayerEditForm'
import { HubProfile } from './myPlayers/HubProfile'
import type { ProfilePage } from './myPlayers/HubProfile'
import { MyPlayerPolls } from './myPlayers/MyPlayerPolls'
import { HubLeaveGuardProvider, useHubLeaveGuardController } from './myPlayers/hubLeaveGuard'
import { HubMenu } from './myPlayers/HubMenu'
import { HubPillStrip } from './myPlayers/HubPillStrip'
import { HubPlayerCard } from './myPlayers/HubPlayerCard'
import { HubSoonPanel } from './myPlayers/HubSoonPanel'
import { HubFields } from './myPlayers/HubFields'
import { HUB, hubPageHeading } from './myPlayers/hubStyle'
import { LEGACY_REDIRECTS, PROFILE_SUBVIEWS, defaultChild, hubBack, hubPath, isLegacyAgentView, isParent, isProfileSubView, legacyProfileTarget, resolveRoute, segmentOf, visibleItems } from './myPlayers/hubNav'
import type { HubLayout, HubNavContext, HubNavItem, HubPillCounts } from './myPlayers/hubNav'
import { forgetProfileChoices } from '../../utils/activeProfile'
import { signOut } from '../../auth/signOut'
import { creamAlpha } from '../../brandTokens'

// docs/specs/121 (builds on 119 3C): the Player Hub, /account/players/:key[/:section[/:item]]. A thin composer: the menu is
// defined once in myPlayers/hubNav.ts; this reads the URL (the only navigation state), picks the layout and renders the
// menu column, the page and the footer's one Back (hubBack, also run by Escape).
//   phone (below 600 px): the main menu, then a page; a parent opens its default page with a pill row as its sub menu;
//   tablet (600 to 899 px) and desktop: the menu column (220 px or 300 px) beside the page.
// An unknown section or item means Availability. Old URLs redirect (LEGACY_REDIRECTS, LegacyDetailsRedirect).

// The old separate details route now lives in the Profile section.
export function LegacyDetailsRedirect() {
  const { key } = useParams<{ key: string }>()
  return <Navigate to={`/account/players/${key}/profile`} replace />
}

export default function MyPlayerPage() {
  // Route params: /:section/:sub is a section and its item (profile/card); /:section/:sub/:leaf adds a Profile sub view (profile/card/edit).
  const { key = '', section: rawSection, sub, leaf } = useParams<{ key: string; section?: string; sub?: string; leaf?: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const playerQuery = useMyPlayer(key)
  const player = playerQuery.data
  const polls = useMyPlayerPolls(key)
  const many = (useMyPlayers().data?.length ?? 0) > 1
  const invitations = useMyInvitations()
  const requests = useMyLinkRequests()
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const layout: HubLayout = phone ? 'phone' : 'wide'
  const [focusId, setFocusId] = useState<string | undefined>()
  const { guard, attempt } = useHubLeaveGuardController()

  const ctx = useMemo<HubNavContext>(() => ({ player: player ? { key: player.key, clubId: player.clubId } : null, person: null, clubSwitches: {} }), [player])
  const tree = useMemo(() => visibleItems(ctx), [ctx])
  const counts: HubPillCounts = {
    openPolls: polls.data?.length ?? 0,
    invitations: invitations.data?.length ?? 0,
    linkRequests: (requests.data ?? []).filter((request) => request.status === 'PENDING').length,
  }

  const route = resolveRoute(rawSection, sub, tree)
  const section = route.section
  const parentOpen = !route.root && isParent(section)
  // A URL naming an action (sign out, find players) never runs it: that is a click, not a page.
  const named = route.item && !route.item.action ? route.item : undefined
  // A parent opens on its first child that is a page and not Soon, on every layout (a phone shows the pill row above it).
  const pageItem: HubNavItem | undefined = parentOpen ? (named ?? defaultChild(section)) : undefined
  const subView = section.id === 'profile' && isProfileSubView(sub, leaf)
  const phoneMenuScreen = phone && route.root

  const back = hubBack({ playerKey: key, layout, many, section: rawSection, item: sub, view: leaf })
  const goBack = () => {
    if (!back) return
    // A Profile sub view with unsaved input asks first (hubLeaveGuard); a clean one leaves at once.
    attempt(() => {
      if (parentOpen && !subView) setFocusId(section.id)
      navigate(back.target)
    })
  }
  // Escape runs the footer's action (Decision 15). Not while a text field has focus (the Field Directory search opts in with
  // data-hub-escape and calls preventDefault when it only clears its text) and not while a Select, Menu or dialog is open.
  const goBackRef = useRef(goBack)
  goBackRef.current = goBack
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]') && !target.closest('[data-hub-escape]')) return
      if (document.querySelector('.MuiModal-root')) return
      goBackRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The Player Card and Medical pages are gone (the card sits on every page, medical aid is on Contact): both go to Contact.
  if (rawSection === 'profile' && (sub === 'card' || sub === 'medical')) return <Navigate to={`/account/players/${key}/profile/contact${leaf ? `/${leaf}` : ''}`} replace />
  // Old Profile links (/profile/edit, /profile/hand-over, /profile/agents/hand-over ...) land on the page that now owns them.
  const profileTarget = rawSection === 'profile' ? (!leaf ? legacyProfileTarget(sub) : isLegacyAgentView(sub, leaf) ? legacyProfileTarget(leaf) : undefined) : undefined
  if (profileTarget) return <Navigate to={`/account/players/${key}/${profileTarget}`} replace />
  if (LEGACY_REDIRECTS[rawSection ?? '']) return <Navigate to={`/account/players/${key}/${LEGACY_REDIRECTS[rawSection ?? '']}`} replace />
  // Desktop and tablet: the bare player URL means Availability (a phone shows the main menu there).
  if (!phone && !rawSection && key) return <Navigate to={hubPath(key, 'availability')} replace />

  const select = (item: HubNavItem) => {
    if (item.action === 'signOut') {
      forgetProfileChoices()
      signOut()
    } else if (item.action === 'findPlayers') {
      navigate('/welcome')
    } else if (isParent(item)) {
      setFocusId(item.children?.[0]?.id)
      navigate(hubPath(key, segmentOf(item)))
    } else if (parentOpen && section.children?.some((child) => child.id === item.id)) {
      navigate(hubPath(key, segmentOf(section), segmentOf(item)))
    } else {
      navigate(hubPath(key, segmentOf(item)))
    }
  }

  // The page ----------------------------------------------------------------------------------------------------------
  const pageLabel = pageItem?.label ?? section.label
  const needsPlayer = !parentOpen || section.id === 'profile'
  let panel
  if (subView && leaf === 'leave') {
    panel = player && <RemoveLinkView player={player} kind="leave" linkId={player.myLinkId} onDone={() => navigate('/account')} />
  } else if (subView && leaf === 'edit' && sub === 'agents') {
    panel = player && (
      <EditAgentsView
        player={player}
        mode={search.get('mode') === 'handover' ? 'HANDOVER' : 'ADD'}
        onModeChange={(next) => setSearch({ mode: next === 'HANDOVER' ? 'handover' : 'add' }, { replace: true })}
      />
    )
  } else if (subView) {
    const cardEdit = leaf === 'edit-card'
    panel = player && (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubPageHeading}>
          {cardEdit ? 'Edit photo and date of birth' : `Edit ${section.children?.find((child) => segmentOf(child) === sub)?.label.toLowerCase()}`}
        </Typography>
        <MyPlayerEditForm key={`${player.key}-${leaf}-${sub}`} player={player} dark section={cardEdit ? 'photo' : (sub as EditSection)} onDone={() => navigate(hubPath(key, 'profile', sub))} />
      </Box>
    )
  } else if (section.id === 'availability') {
    panel = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubPageHeading}>
          Availability
        </Typography>
        {player && <MyPlayerPolls playerKey={player.key} playerName={player.firstName} />}
      </Box>
    )
  } else if (section.id === 'profile' && pageItem) {
    panel = player && <HubProfile player={player} page={segmentOf(pageItem) as ProfilePage} />
  } else if (pageItem?.id === 'club.fields') {
    panel = <HubFields playerKey={player?.key} />
  } else if (pageItem?.id === 'account.invitations') {
    panel = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubPageHeading}>
          Invitations
        </Typography>
        <InvitationsList />
      </Box>
    )
  } else if (pageItem?.id === 'account.requests') {
    panel = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubPageHeading}>
          Link requests
        </Typography>
        <MyLinkRequests dark />
      </Box>
    )
  } else if (pageItem) {
    panel = <HubSoonPanel title={pageItem.label} copy={pageItem.soonCopy} />
  }

  // The menu ----------------------------------------------------------------------------------------------------------
  const listItems = phone || !parentOpen ? tree : (section.children ?? [])
  const selectedId = phone ? undefined : parentOpen ? pageItem?.id : section.id
  const card = player ? <HubPlayerCard player={player} /> : <Skeleton variant="rounded" height={104} sx={{ m: 2, bgcolor: creamAlpha(0.12) }} />
  const menu = subView ? undefined : phone && !phoneMenuScreen ? undefined : (
    <>
      {/* On Profile pages the page shows its own card, so the menu column starts with the list (wide and tablet). */}
      {(phone ? route.root : section.id !== 'profile' || route.root) && card}
      <HubMenu items={listItems} selectedId={selectedId} counts={counts} onSelect={select} levelKey={parentOpen && !phone ? section.id : 'root'} focusId={focusId} />
    </>
  )

  const title = subView && leaf ? (
    PROFILE_SUBVIEWS[leaf]
  ) : parentOpen ? (
    <>
      Player Hub /{' '}
      <Box component="span" sx={{ color: HUB.gold }}>
        {section.label}
      </Box>
    </>
  ) : (
    'Player Hub'
  )

  const footer = back ? <HubFooterButton onClick={goBack}>{back.label}</HubFooterButton> : undefined
  const phonePage = phone && !phoneMenuScreen

  return (
    <HubLeaveGuardProvider value={guard}>
    <HubFrame
      fill
      title={title}
      phoneTitle={phoneMenuScreen || (parentOpen && !subView) ? 'slim' : 'hidden'}
      stickyTop={phone && parentOpen && !subView ? <HubPillStrip label={`${section.label} pages`} items={section.children ?? []} selectedId={pageItem?.id} onSelect={select} /> : undefined}
      menu={menu}
      hideContent={phoneMenuScreen}
      footer={footer}
      testId="my-player-page"
    >
      {playerQuery.isError && <Alert severity="error">We could not load this player. Please try again.</Alert>}
      {!player && !playerQuery.isError && (needsPlayer || subView) && <Skeleton variant="rounded" height={112} sx={{ bgcolor: creamAlpha(0.12) }} />}
      {phonePage && !subView && !parentOpen && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44 }}>
          <Typography component="h1" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 28, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1 }}>
            {pageLabel}
          </Typography>
          {player && <Typography sx={{ ml: 'auto', color: HUB.muted, fontSize: 14, textAlign: 'right' }}>{player.firstName}</Typography>}
        </Box>
      )}
      {panel}
    </HubFrame>
    </HubLeaveGuardProvider>
  )
}
