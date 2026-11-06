import type { ReactNode } from 'react'
import { Box, ButtonBase, Slider, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import MenuIcon from '@mui/icons-material/Menu'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { useLocation } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { AccountShell } from '../AccountShell'
import { HUB, HUB_GROUND, hubOutlineButton } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'
import { HubHeaderProvider, bandTitle, useHubHeaderState } from './HubPageHeader'
import { useHubGlass } from './useHubGlass'
import { PEEK_EASE, PEEK_IN_MS, PEEK_OUT_MS, VEIL_IN_MS, VEIL_OUT_MS, useHubMenuAutoCollapse } from './useHubMenuAutoCollapse'

const MENU_WIDTH = 300

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
  // Kept for a screen that wants no band on a phone; the Player Hub pages no longer use it (the band is the phone header too).
  phoneTitle?: 'slim' | 'hidden'
  // 'solid' (default) puts a mostly opaque dark ground behind the content so text is not fought by the page backdrop;
  // 'clear' lets the backdrop show through (sparse screens such as the player picker).
  panel?: 'solid' | 'clear'
  // docs/specs/121, opt-in (the Player Hub only; the picker and Find players keep their own height): the console fills the
  // window (24 px clear at the bottom from sm, the whole screen on a phone, minimum 560 px), is min(1760px, 96vw) wide, the
  // menu column (260 px from sm, 300 px from md) and the content scroll independently, the content ground is the solid
  // HUB_GROUND, and the footer is pinned (56 px high, safe-area padding). With `fill` the caller decides what shows: `menu`
  // and `children` side by side, or `hideContent` to give the whole body to the menu (a phone's menu screens).
  fill?: boolean
  hideContent?: boolean
  // A strip pinned to the top of the scrolling content (the phone's pill row), bleeding to the content edges.
  stickyTop?: ReactNode
}

export function HubFrame({ title, menu, footer, children, maxWidth = 1320, testId, phoneTitle = 'slim', panel = 'solid', fill = false, hideContent = false, stickyTop }: HubFrameProps) {
  const header = useHubHeaderState()
  const { glass, setGlass } = useHubGlass()
  const a = (v: number) => (v * glass).toFixed(3)
  const twoColumns = Boolean(menu) && !hideContent
  // docs/specs/145 decision 12: from md up, on a content page (never the phone's main menu screen), the menu column collapses to an icon rail.
  const wide = useMediaQuery(useTheme().breakpoints.up('md'))
  const { pathname } = useLocation()
  const autoCollapse = useHubMenuAutoCollapse(fill && twoColumns && wide, pathname)
  const railed = autoCollapse.collapsed
  const columns = fill
    ? { xs: '1fr', sm: twoColumns ? '260px minmax(0, 1fr)' : '1fr', md: twoColumns ? (railed ? '1fr' : `${MENU_WIDTH}px minmax(0, 1fr)`) : '1fr' }
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
        bgcolor: panel === 'solid' ? `rgba(5, 30, 22, ${a(fill ? 0.92 : 0.88)})` : 'transparent',
        p: { xs: '16px 16px', md: '36px 40px' },
        minWidth: 0,
      }}
    >
      {stickyTop && <Box sx={{ position: 'sticky', top: 0, zIndex: 2, mx: -2, mt: -2, mb: 2, bgcolor: HUB_GROUND }}>{stickyTop}</Box>}
      <Box sx={{ position: 'relative', display: 'grid', gap: { xs: 2.25, md: 3.25 } }}>{children}</Box>
    </Box>
  )

  return (
    <HubHeaderProvider value={header.value}>
    <AccountShell
      bare
      fill={fill}
      maxWidth={fill ? { xs: '100%', sm: 'min(1760px, 96vw)' } : maxWidth}
      testId={testId}
    >
      <Box
        sx={{
          border: `1px solid ${HUB.line}`,
          borderRadius: '6px',
          overflow: 'hidden',
          // Translucent so the page's own cricket-scene backdrop shows through (no scene of its own).
          background: `linear-gradient(180deg, rgba(10,51,34,${a(0.78)}) 0%, rgba(7,42,28,${a(0.82)}) 55%, rgba(5,32,26,${a(0.88)}) 100%)`,
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
        {/* docs/specs/145 decision 15: the fixed page header. A HubPageHeader draws into the slot; `title` is the fallback text. */}
        <Box sx={{ gridRow: 1, minHeight: { xs: 56, md: 64 }, boxSizing: 'border-box', px: { xs: 2, md: 2.5 }, borderBottom: `1px solid ${HUB.line}`, display: { xs: phoneTitle === 'hidden' ? 'none' : 'flex', sm: 'flex' }, alignItems: 'center', minWidth: 0 }}>
          {railed && (
            <ButtonBase
              aria-label="Open menu"
              aria-haspopup="true"
              aria-expanded={autoCollapse.peek}
              data-testid="hub-menu-button"
              onMouseEnter={autoCollapse.hoverOpenPeek}
              onMouseLeave={() => {
                autoCollapse.cancelHoverOpen()
                autoCollapse.closePeek()
              }}
              onFocus={autoCollapse.openPeek}
              onClick={autoCollapse.togglePeek}
              sx={{ flex: 'none', width: 44, height: 44, mr: 1.75, borderRadius: '4px', border: `1px solid ${HUB.line}`, bgcolor: blackAlpha(0.28), color: HUB.cream, '&:hover': { borderColor: HUB.sand, bgcolor: blackAlpha(0.4) }, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
            >
              <MenuIcon />
            </ButtonBase>
          )}
          <Box ref={header.setSlot} sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            {!header.claimed && (
              <Typography component="h1" noWrap sx={bandTitle}>
                {title}
              </Typography>
            )}
          </Box>
          {/* TEMPORARY: see-through control (owner, 2026-11-06); remove once a value is chosen. */}
          {fill && (
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.25, flex: 'none', ml: 2, width: 190, color: HUB.sand }}>
              <Typography sx={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>Glass</Typography>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.02}
                value={glass}
                onChange={(_, v) => setGlass(v as number)}
                aria-label="Console transparency (temporary)"
                data-testid="hub-glass-slider"
                sx={{ color: HUB.gold }}
              />
            </Box>
          )}
        </Box>

        {/* Explicit rows: a hidden title bar (phone) must not let the body and the footer slip up a row, or the footer would float. */}
        <Box sx={{ gridRow: 2, display: 'grid', gridTemplateColumns: columns, position: 'relative', ...(fill ? { gridTemplateRows: 'minmax(0, 1fr)', minHeight: 0 } : { minHeight: { md: 'max(560px, calc(100vh - 450px))' } }), minWidth: 0 }}>
          {fill && menu ? (
            <Box
              data-testid="hub-menu-column"
              data-collapsed={railed}
              {...(autoCollapse.active ? autoCollapse.columnProps : {})}
              sx={{
                minHeight: 0,
                minWidth: 0,
                overflow: 'hidden',
                borderRight: { xs: 0, sm: `1px solid ${HUB.line}` },
                display: 'flex',
                flexDirection: 'column',
                ...(railed
                  ? {
                      // Collapsed: the menu is a panel OVER the content (nothing reflows), faded in by the menu button's hover, click or focus.
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: MENU_WIDTH,
                      zIndex: 7,
                      bgcolor: 'rgba(5, 30, 22, 0.98)',
                      boxShadow: '12px 0 32px rgba(0,0,0,0.45)',
                      // A slide: the panel glides in from the left edge over PEEK_IN_MS with an even ease and slides back out over PEEK_OUT_MS.
                      opacity: autoCollapse.peek ? 1 : 0,
                      transform: autoCollapse.peek ? 'translateX(0)' : 'translateX(-100%)',
                      visibility: autoCollapse.peek ? 'visible' : 'hidden',
                      '@media (prefers-reduced-motion: no-preference)': {
                        transition: autoCollapse.peek
                          ? `transform ${PEEK_IN_MS}ms ${PEEK_EASE}, opacity ${PEEK_IN_MS * 0.7}ms ease`
                          : `transform ${PEEK_OUT_MS}ms ${PEEK_EASE}, opacity ${PEEK_OUT_MS}ms ease 80ms, visibility 0s linear ${PEEK_OUT_MS + 80}ms`,
                      },
                    }
                  : { position: 'relative' }),
              }}
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
                }}
              >
                {menu}
                {/* Flexible space under the menu, as in the mockup. */}
                <Box aria-hidden sx={{ flex: 1, display: { xs: 'none', sm: 'block' }, borderTop: `1px solid ${HUB.line}`, bgcolor: blackAlpha(0.22) }} />
              </Box>
              {autoCollapse.active && (
                <ButtonBase
                  aria-label={railed ? 'Keep menu open' : 'Collapse menu'}
                  title={railed ? 'Keep menu open' : 'Collapse menu'}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (railed) autoCollapse.pin()
                    else autoCollapse.toggle()
                  }}
                  sx={{ position: 'absolute', top: 10, left: 10, zIndex: 2, width: 32, height: 32, borderRadius: '50%', border: `1px solid ${HUB.line}`, bgcolor: blackAlpha(0.4), color: HUB.cream, '&:hover': { bgcolor: blackAlpha(0.6) }, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
                >
                  {railed ? <PushPinOutlinedIcon fontSize="small" /> : <ChevronLeftIcon />}
                </ButtonBase>
              )}
            </Box>
          ) : (
            menu
          )}
          {!hideContent && content}
          {/* docs/specs/145 decision 12: the dissolve that hides the layout swap when the menu opens or closes (see useHubMenuAutoCollapse). */}
          {autoCollapse.active && (
            <Box
              aria-hidden
              data-testid="hub-menu-veil"
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 6,
                pointerEvents: autoCollapse.veil === 'idle' ? 'none' : 'auto',
                bgcolor: HUB_GROUND,
                opacity: autoCollapse.veil === 'in' ? 1 : 0,
                transition: autoCollapse.veil === 'in' ? `opacity ${VEIL_IN_MS}ms ease-in` : autoCollapse.veil === 'out' ? `opacity ${VEIL_OUT_MS}ms ease-out` : 'none',
              }}
            />
          )}
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
    </HubHeaderProvider>
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
