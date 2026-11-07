import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { useLocation } from 'react-router-dom'
import { blackAlpha } from '../../../../brandTokens'
import { HUB } from '../hubStyle'
import { HubTicker } from '../HubTicker'
import { TICKER_MIN_WIDTH_PX } from '../tickerConfig'
import { buildTickerItems } from '../tickerItems'
import { drawTickerSeed, tickerRoute } from '../tickerRoute'
import type { TickerItem } from '../tickerTypes'
import { useHubTickerPreference } from '../useHubTickerPreference'
import { useTickerCycle } from '../useTickerCycle'
import { useTickerData } from '../useTickerData'
import type { KindRules } from '../weightedShuffle'

// docs/specs/146 section 1 and 8: the whole Hub console footer band. The Back slot (HubFooterButton, unchanged) sits at the left and
// the scoreboard ticker fills the rest. With nothing to show, with the ticker off, on Watch Live, on an edit sub-view, on a screen
// with no player, or when under TICKER_MIN_WIDTH_PX is left for it, the footer is exactly today's footer: just the Back button, or no
// footer at all where there is no Back. The band keeps the pinned 56 px of docs/specs/121 and its safe-area padding.
export interface HubFooterProps {
  // The Back slot (a HubFooterButton), when the page has one.
  back?: ReactNode
  // The Player Hub console (docs/specs/121): 56 px high with the safe-area padding.
  fill?: boolean
  // Stories and tests: use these items instead of reading the three Hub reads (no request is made).
  items?: TickerItem[]
  kinds?: KindRules
}

const bandSx = { gridRow: 3, alignSelf: 'end', borderTop: `1px solid ${HUB.line}` } as const

// Today's footer, unchanged.
function PlainFooter({ back, fill }: { back?: ReactNode; fill?: boolean }) {
  if (!back) return null
  return (
    <Box
      component="footer"
      data-testid="hub-footer"
      data-ticker="false"
      sx={{ ...bandSx, px: { xs: 2, md: 2.5 }, py: 1, bgcolor: blackAlpha(0.35), display: 'flex', alignItems: 'center', ...(fill && { minHeight: 56, pb: 'max(8px, env(safe-area-inset-bottom))' }) }}
    >
      {back}
    </Box>
  )
}

export function HubFooter({ back, fill, items, kinds }: HubFooterProps) {
  const { pathname } = useLocation()
  const route = tickerRoute(pathname)
  // A screen with no player never mounts the data hooks (so it needs no query client either).
  if (!route.playerKey || !route.visible) return <PlainFooter back={back} fill={fill} />
  return <PlayerFooter back={back} fill={fill} playerKey={route.playerKey} routeKey={route.routeKey} items={items} kinds={kinds} />
}

interface PlayerFooterProps extends HubFooterProps {
  playerKey: string
  routeKey: string
}

function PlayerFooter({ back, fill, playerKey, routeKey, items: given, kinds }: PlayerFooterProps) {
  const [on] = useHubTickerPreference()
  const ctx = useTickerData(playerKey, { enabled: on && given === undefined, routeKey })
  const built = useMemo(() => (!on ? [] : (given ?? (ctx ? buildTickerItems(ctx) : []))), [on, given, ctx])
  const seed = useMemo(() => drawTickerSeed(routeKey), [routeKey])
  const cycle = useTickerCycle(built, seed, kinds)

  const slotRef = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(true)
  const hasTicker = cycle.length > 0
  useLayoutEffect(() => {
    const slot = slotRef.current
    if (!slot || typeof ResizeObserver === 'undefined') return
    const measure = () => setRoom(slot.clientWidth >= TICKER_MIN_WIDTH_PX)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(slot)
    return () => observer.disconnect()
  }, [hasTicker])

  if (!hasTicker) return <PlainFooter back={back} fill={fill} />
  return (
    <Box component="footer" data-testid="hub-footer" data-ticker={room ? 'true' : 'false'} sx={{ ...bandSx, bgcolor: blackAlpha(0.42), pb: 'env(safe-area-inset-bottom)' }}>
      <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 56, minWidth: 0 }}>
        {back && (
          <Box data-testid="hub-footer-back" sx={{ flex: 'none', maxWidth: '100%', display: 'flex', alignItems: 'center', px: { xs: 2, md: 2.5 }, ...(room && { borderRight: `1px solid ${HUB.lineSoft}` }) }}>
            {back}
          </Box>
        )}
        <Box ref={slotRef} data-testid="hub-footer-ticker" sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
          {room && <HubTicker items={cycle} kinds={kinds} />}
        </Box>
      </Box>
    </Box>
  )
}
