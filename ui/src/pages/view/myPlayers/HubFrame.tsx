import type { ReactNode } from 'react'
import { Box, ButtonBase, Typography, useMediaQuery } from '@mui/material'
import { keyframes, useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useLocation } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { AccountShell } from '../AccountShell'
import { HUB, HUB_GROUND, hubOutlineButton } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'
import { HubMenuCollapsedProvider, MENU_COLLAPSE_MS, useHubMenuAutoCollapse } from './useHubMenuAutoCollapse'

// The countdown line along the foot of the menu column while the collapse timer runs.
const countdown = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`
const RAIL_WIDTH = 64

// docs/specs/119 3C: the dark console frame shared by the player hub, the picker and Find players: a title bar, an optional
// menu column on the left (desktop) or above (phone), the panel with the cricket scene, and an optional footer bar.
// Nothing opens over it; a sub-view replaces the panel and offers Back.
export interface HubFrameProps {
  title: ReactNode
  menu?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  maxWidth?: number
  testId?: string
  // Below sm the title bar is slim by default; 'hidden' removes it (the hub shows its own headers there).
  phoneTitle?: 'slim' | 'hidden'
  // 'solid' (default) puts a mostly opaque dark ground behind the content so text is not fought by the page backdrop;
  // 'clear' lets the backdrop show through (sparse screens such as the player picker).
  panel?: 'solid' | 'clear'
  // docs/specs/121, opt-in (the Player Hub only; the picker and Find players keep their own height): the console fills the
  // window (24 px clear at the bottom from sm, the whole screen on a phone, minimum 560 px), is min(1400px, 90vw) wide, the
  // menu column (260 px from sm, 300 px from md) and the content scroll independently, the content ground is the solid
  // HUB_GROUND, and the footer is pinned (56 px high, safe-area padding). With `fill` the caller decides what shows: `menu`
  // and `children` side by side, or `hideContent` to give the whole body to the menu (a phone's menu screens).
  fill?: boolean
  hideContent?: boolean
  // A strip pinned to the top of the scrolling content (the phone's pill row), bleeding to the content edges.
  stickyTop?: ReactNode
}

export function HubFrame({ title, menu, footer, children, maxWidth = 1320, testId, phoneTitle = 'slim', panel = 'solid', fill = false, hideContent = false, stickyTop }: HubFrameProps) {
  const twoColumns = Boolean(menu) && !hideContent
  // docs/specs/145 decision 12: from md up, on a content page (never the phone's main menu screen), the menu column collapses to an icon rail.
  const wide = useMediaQuery(useTheme().breakpoints.up('md'))
  const { pathname } = useLocation()
  const autoCollapse = useHubMenuAutoCollapse(fill && twoColumns && wide, pathname)
  const railed = autoCollapse.collapsed
  const columns = fill
    ? { xs: '1fr', sm: twoColumns ? '260px minmax(0, 1fr)' : '1fr', md: twoColumns ? `${railed ? RAIL_WIDTH : 300}px minmax(0, 1fr)` : '1fr' }
    : { xs: '1fr', md: menu ? 'minmax(250px, 36%) 1fr' : '1fr' }
  const content = (
    <Box
      component="section"
      aria-live="polite"
      sx={{
        position: 'relative',
        overflowX: 'hidden',
        overflowY: fill ? 'auto' : 'hidden',
        // No browser scrollbar on the dark console (owner, 2026-11-06): a bright default track beside dark panels looked wrong. Scrolling by
        // wheel, trackpad, touch and keyboard is unchanged; the Results page has its own floating section arrows.
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        minHeight: 0,
        bgcolor: panel === 'solid' ? (fill ? HUB_GROUND : 'rgba(5, 30, 22, 0.88)') : 'transparent',
        p: { xs: '16px 16px', md: '36px 40px' },
        minWidth: 0,
      }}
    >
      {stickyTop && <Box sx={{ position: 'sticky', top: 0, zIndex: 2, mx: -2, mt: -2, mb: 2, bgcolor: HUB_GROUND }}>{stickyTop}</Box>}
      <Box sx={{ position: 'relative', display: 'grid', gap: { xs: 2.25, md: 3.25 } }}>{children}</Box>
    </Box>
  )

  return (
    <AccountShell
      bare
      fill={fill}
      maxWidth={fill ? { xs: '100%', sm: 'min(1400px, 90vw)' } : maxWidth}
      testId={testId}
    >
      <Box
        sx={{
          border: `1px solid ${HUB.line}`,
          borderRadius: '6px',
          overflow: 'hidden',
          // Translucent so the page's own cricket-scene backdrop shows through (no scene of its own).
          background: 'linear-gradient(180deg, rgba(10,51,34,0.78) 0%, rgba(7,42,28,0.82) 55%, rgba(5,32,26,0.88) 100%)',
          backdropFilter: 'blur(1.5px)',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          ...(fill && {
            // 56 px header, 16 px above and 24 px below from sm; a phone's console is the whole screen under the header.
            height: { xs: 'calc(100vh - 56px)', sm: 'max(560px, calc(100vh - 96px))' },
            minHeight: 560,
            '@supports (height: 100dvh)': { height: { xs: 'calc(100dvh - 56px)', sm: 'max(560px, calc(100dvh - 96px))' } },
            borderRadius: { xs: 0, sm: '6px' },
            borderWidth: { xs: 0, sm: 1 },
          }),
        }}
      >
        <Box sx={{ gridRow: 1, px: { xs: 2, md: 2.5 }, py: { xs: 0.75, md: 2.25 }, borderBottom: `1px solid ${HUB.line}`, display: { xs: phoneTitle === 'hidden' ? 'none' : 'flex', sm: 'flex' }, justifyContent: 'flex-end' }}>
          <Typography component="h1" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: { xs: 22, md: 'clamp(24px, 3vw, 32px)' }, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1, textAlign: 'right' }}>
            {title}
          </Typography>
        </Box>

        {/* Explicit rows: a hidden title bar (phone) must not let the body and the footer slip up a row, or the footer would float. */}
        <Box sx={{ gridRow: 2, display: 'grid', gridTemplateColumns: columns, '@media (prefers-reduced-motion: no-preference)': { transition: 'grid-template-columns 250ms ease' }, ...(fill ? { gridTemplateRows: 'minmax(0, 1fr)', minHeight: 0 } : { minHeight: { md: 'max(560px, calc(100vh - 450px))' } }), minWidth: 0 }}>
          {fill && menu ? (
            <HubMenuCollapsedProvider value={railed}>
              <Box
                data-testid="hub-menu-column"
                data-collapsed={railed}
                {...(autoCollapse.active ? autoCollapse.columnProps : {})}
                sx={{ position: 'relative', minHeight: 0, minWidth: 0, overflow: 'hidden', borderRight: { xs: 0, sm: `1px solid ${HUB.line}` }, display: 'flex', flexDirection: 'column' }}
              >
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                    display: 'flex',
                    flexDirection: 'column',
                    background: `linear-gradient(180deg, transparent, ${blackAlpha(0.18)})`,
                    // The rail holds only the icon buttons: the player card (or its skeleton) and the spacer go.
                    ...(railed && { '& > :not(nav)': { display: 'none' } }),
                    ...(autoCollapse.active && { pb: { md: 6 } }),
                  }}
                >
                  {menu}
                  {/* Flexible space under the menu, as in the mockup. */}
                  <Box aria-hidden sx={{ flex: 1, display: { xs: 'none', sm: 'block' }, borderTop: `1px solid ${HUB.line}`, bgcolor: blackAlpha(0.22) }} />
                </Box>
                {autoCollapse.active && (
                  <>
                    <ButtonBase
                      aria-label={railed ? 'Expand menu' : 'Collapse menu'}
                      onClick={(event) => {
                        event.stopPropagation()
                        autoCollapse.toggle()
                      }}
                      sx={{ position: 'absolute', bottom: 10, right: railed ? (RAIL_WIDTH - 36) / 2 : 10, width: 36, height: 36, borderRadius: '50%', border: `1px solid ${HUB.line}`, bgcolor: blackAlpha(0.4), color: HUB.cream, '&:hover': { bgcolor: blackAlpha(0.6) }, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
                    >
                      {railed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                    </ButtonBase>
                    {autoCollapse.armed && (
                      <Box
                        key={pathname}
                        aria-hidden
                        data-testid="hub-menu-timer"
                        sx={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: '100%', bgcolor: HUB.gold, transformOrigin: 'left', animation: `${countdown} ${MENU_COLLAPSE_MS}ms linear forwards`, '@media (prefers-reduced-motion: reduce)': { display: 'none' } }}
                      />
                    )}
                  </>
                )}
              </Box>
            </HubMenuCollapsedProvider>
          ) : (
            menu
          )}
          {!hideContent && content}
        </Box>

        {footer && (
          <Box
            component="footer"
            sx={{
              gridRow: 3,
              alignSelf: 'end',
              borderTop: `1px solid ${HUB.line}`,
              px: { xs: 2, md: 2.5 },
              py: 1,
              bgcolor: blackAlpha(0.35),
              display: 'flex',
              alignItems: 'center',
              ...(fill && { minHeight: 56, pb: 'max(8px, env(safe-area-inset-bottom))' }),
            }}
          >
            {footer}
          </Box>
        )}
      </Box>
    </AccountShell>
  )
}

// The footer's Back slot.
export function HubFooterButton({ onClick, children, icon }: { onClick: () => void; children: string; icon?: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{ minHeight: 44, gap: 1.25, fontFamily: HUB.display, fontWeight: 600, fontSize: 20, letterSpacing: '.12em', textTransform: 'uppercase', color: HUB.cream, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
    >
      {icon ?? <ArrowBackIcon sx={{ fontSize: 20 }} />}
      {children}
    </ButtonBase>
  )
}

// Outlined Back at the top left of the panel. Not used inside the Player Hub (docs/specs/121: the footer is the one Back).
export function HubBackButton({ onClick, children = 'Back' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <Box>
      <Button variant="secondary" size="compact" startIcon={<ArrowBackIcon />} onClick={onClick} sx={hubOutlineButton}>
        {children}
      </Button>
    </Box>
  )
}
