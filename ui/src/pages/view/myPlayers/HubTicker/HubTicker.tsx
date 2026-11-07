import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent, ReactNode } from 'react'
import { Box, IconButton, useMediaQuery } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious'
import { Link as RouterLink } from 'react-router-dom'
import { PulseDot } from '../../../../components/RecordCard/RecordCard'
import { TICKER_FADE, TICKER_TONES, blackAlpha, creamAlpha } from '../../../../brandTokens'
import { HUB } from '../hubStyle'
import { isHttps } from '../leagueFormat'
import { TICKER_FALLBACK_S_PER_ITEM, TICKER_SPEED_PX_PER_S, TICKER_STATIC_MS, TICKER_TOUCH_GRACE_MS } from '../tickerConfig'
import { TICKER_KIND_RULES } from '../tickerKindRules'
import { itemKey, itemName, itemSentence } from '../tickerText'
import type { TickerItem, TickerKindRules, TickerPart } from '../tickerTypes'
import type { KindRules } from '../weightedShuffle'

// docs/specs/146 section 6 and 7 (variant A of docs/mockups/player-hub-ticker-round2-mockup.html): the scoreboard strip along the
// Hub footer. It renders the items it is given, in the order it is given; it knows nothing about matches, results or polls and imports
// no source file (a guard test pins it).
//   - A slow right-to-left marquee: one track holding the cycle twice, moved 0 to -50% by a CSS animation (transform only).
//   - If the whole cycle fits, it does not scroll: the items sit centred. Under prefers-reduced-motion it shows one item at a time.
//   - Paused by hover, a held touch (with a grace), keyboard focus on an item and the Pause button (the WCAG 2.2.2 control).
//   - The first copy of the cycle is the accessible list; the second copy is aria-hidden with tabIndex -1. No live region.

const marquee = keyframes`
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-50%, 0, 0); }
`

const FADE_PX = 70
const display = { fontFamily: HUB.display } as const
const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' } as const

const controlSx = {
  width: 44,
  height: 44,
  color: HUB.cream,
  borderRadius: '4px',
  '&:hover': { bgcolor: creamAlpha(0.1) },
  '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2 },
} as const

function TypeChip({ rules }: { rules: TickerKindRules }) {
  return (
    <Box
      component="span"
      data-testid="ticker-chip"
      sx={{ ...display, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', px: '9px', py: '3px', borderRadius: '3px', border: '1px solid currentColor', lineHeight: 1.2, color: TICKER_TONES[rules.tone] }}
    >
      {rules.pulse && <PulseDot />}
      {rules.label}
    </Box>
  )
}

function Part({ part }: { part: TickerPart }) {
  if (part.type === 'strong') return <Box component="b" sx={{ color: HUB.gold, fontWeight: 700 }}>{part.text}</Box>
  if (part.type === 'muted') return <Box component="span" sx={{ color: HUB.muted, ml: 1.25 }}>{part.text}</Box>
  if (part.type === 'plate') {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, height: 30, px: 1.5, borderRadius: '3px', bgcolor: HUB.cream, color: HUB.ink, fontWeight: 700, letterSpacing: '0.12em' }}>
        {isHttps(part.logoUrl) && <Box component="img" src={part.logoUrl} alt="" sx={{ height: 20, width: 'auto' }} />}
        {part.text}
      </Box>
    )
  }
  return <>{part.text}</>
}

interface EntryProps {
  item: TickerItem
  rules: TickerKindRules
  // The decorative second copy: no tab stop, hidden from assistive technology by its list.
  decorative?: boolean
  truncate?: boolean
  onFocusItem?: (element: HTMLElement) => void
}

function Entry({ item, rules, decorative, truncate, onFocusItem }: EntryProps) {
  const text = (
    <Box component="span" sx={{ ...display, fontWeight: 600, fontSize: { xs: 17, sm: 20 }, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.cream, whiteSpace: 'nowrap', ...(truncate && { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
      {item.parts.map((part, index) => <Part key={index} part={part} />)}
    </Box>
  )
  const layout = { display: 'flex', alignItems: 'center', gap: '12px', minHeight: 44, px: 1.25, minWidth: 0, maxWidth: '100%' } as const
  if (!item.to) {
    return (
      <Box component="span" sx={layout}>
        <TypeChip rules={rules} />
        {text}
      </Box>
    )
  }
  return (
    <Box
      component={RouterLink}
      to={item.to}
      aria-label={itemName(item, rules)}
      title={itemSentence(item)}
      tabIndex={decorative ? -1 : undefined}
      onFocus={(event: FocusEvent<HTMLElement>) => onFocusItem?.(event.currentTarget)}
      data-testid="ticker-link"
      sx={{ ...layout, color: 'inherit', textDecoration: 'none', borderRadius: '4px', '&:hover': { bgcolor: creamAlpha(0.08) }, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2 } }}
    >
      <TypeChip rules={rules} />
      {text}
    </Box>
  )
}

const separator = <Box component="span" aria-hidden sx={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', bgcolor: HUB.gold, opacity: 0.7, mx: '26px' }} />

const listSx = { listStyle: 'none', m: 0, p: 0, display: 'flex', alignItems: 'center', flex: 'none', position: 'relative' } as const

export interface HubTickerProps {
  // The cycle, already ordered (orderTickerItems). An item of a kind without rules is not shown.
  items: TickerItem[]
  // Defaults to the built kinds; a story passes synthetic kinds to prove the contract needs no change here.
  kinds?: KindRules
  // Stories and tests: force the reduced-motion rotation on (true) or the marquee (false) instead of reading the system setting.
  reducedMotion?: boolean
}

export function HubTicker({ items, kinds = TICKER_KIND_RULES, reducedMotion }: HubTickerProps) {
  const shown = useMemo(() => items.filter((item) => kinds[item.kind]), [items, kinds])
  if (shown.length === 0) return null
  return <Strip items={shown} kinds={kinds} reducedMotion={reducedMotion} />
}

type Mode = 'marquee' | 'static' | 'rotate'

function Strip({ items, kinds, reducedMotion }: { items: TickerItem[]; kinds: KindRules; reducedMotion?: boolean }) {
  const preferred = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true })
  const reduced = reducedMotion ?? preferred
  const [userPaused, setUserPaused] = useState(false)
  const [hover, setHover] = useState(false)
  const [touch, setTouch] = useState(false)
  const [focused, setFocused] = useState(false)
  const [index, setIndex] = useState(0)
  const [size, setSize] = useState({ cycle: 0, view: 0 })
  const viewRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const touchTimer = useRef<number | undefined>(undefined)

  const count = items.length
  const fits = size.cycle > 0 && size.cycle <= size.view
  const mode: Mode = reduced ? 'rotate' : fits ? 'static' : 'marquee'
  const paused = userPaused || hover || touch || focused
  const current = index % count
  // The marquee restarts only when the set of items changes, not when the order does.
  const idSet = useMemo(() => items.map(itemKey).sort().join('|'), [items])

  useLayoutEffect(() => {
    const view = viewRef.current
    const list = listRef.current
    if (!view || !list || typeof ResizeObserver === 'undefined') return
    const measure = () => setSize((previous) => (previous.cycle === list.offsetWidth && previous.view === view.clientWidth ? previous : { cycle: list.offsetWidth, view: view.clientWidth }))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(view)
    observer.observe(list)
    return () => observer.disconnect()
  }, [idSet, mode])

  useEffect(() => {
    if (mode !== 'rotate' || paused || count < 2) return
    const id = window.setTimeout(() => setIndex((value) => (value + 1) % count), TICKER_STATIC_MS)
    return () => window.clearTimeout(id)
  }, [mode, paused, count, current])

  useEffect(() => () => window.clearTimeout(touchTimer.current), [])

  const duration = size.cycle > 0 ? size.cycle / TICKER_SPEED_PX_PER_S : count * TICKER_FALLBACK_S_PER_ITEM

  // A focused item is brought fully into view: the paused animation is moved to the point where the item starts clear of the fade.
  const reveal = (element: HTMLElement) => {
    setFocused(true)
    const view = viewRef.current
    const track = trackRef.current
    const list = listRef.current
    if (mode !== 'marquee' || !view || !track || !list || size.cycle <= 0) return
    const area = view.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    if (box.left >= area.left && box.right <= area.right) return
    const animation = track.getAnimations?.()[0]
    if (!animation) return
    const start = Math.max(0, element.offsetLeft - FADE_PX)
    animation.currentTime = ((start % size.cycle) / size.cycle) * duration * 1000
  }

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
  }
  const onTouchEnd = () => {
    window.clearTimeout(touchTimer.current)
    touchTimer.current = window.setTimeout(() => setTouch(false), TICKER_TOUCH_GRACE_MS)
  }

  const renderList = (decorative: boolean): ReactNode => (
    <Box
      component="ul"
      ref={decorative ? undefined : listRef}
      aria-label={decorative ? undefined : 'Scoreboard ticker'}
      aria-hidden={decorative ? true : undefined}
      data-testid={decorative ? 'ticker-copy' : 'ticker-list'}
      sx={listSx}
    >
      {items.map((item, position) => (
        <Box component="li" key={`${position}-${itemKey(item)}`} sx={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
          <Entry item={item} rules={kinds[item.kind] as TickerKindRules} decorative={decorative} onFocusItem={decorative ? undefined : reveal} />
          {(mode === 'marquee' || position < count - 1) && separator}
        </Box>
      ))}
    </Box>
  )

  return (
    <Box data-testid="hub-ticker" data-mode={mode} data-paused={paused ? 'true' : 'false'} sx={{ flex: 1, minWidth: 0, minHeight: 56, display: 'flex', alignItems: 'stretch', position: 'relative', overflow: 'hidden' }}>
      <Box
        ref={viewRef}
        data-testid="ticker-viewport"
        onPointerEnter={(event) => event.pointerType !== 'touch' && setHover(true)}
        onPointerLeave={() => setHover(false)}
        onTouchStart={() => {
          window.clearTimeout(touchTimer.current)
          setTouch(true)
        }}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onFocus={() => setFocused(true)}
        onBlur={onBlur}
        sx={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: mode === 'marquee' ? 'flex-start' : 'center' }}
      >
        {mode === 'marquee' && (
          <>
            <Box aria-hidden sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: FADE_PX, zIndex: 2, pointerEvents: 'none', background: `linear-gradient(90deg, ${TICKER_FADE}, ${blackAlpha(0)})` }} />
            <Box aria-hidden sx={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: FADE_PX, zIndex: 2, pointerEvents: 'none', background: `linear-gradient(270deg, ${TICKER_FADE}, ${blackAlpha(0)})` }} />
            <Box
              key={idSet}
              ref={trackRef}
              data-testid="ticker-track"
              sx={{ display: 'flex', alignItems: 'center', width: 'max-content', willChange: 'transform', animation: `${marquee} ${duration}s linear infinite` }}
              style={{ animationPlayState: paused ? 'paused' : 'running' }}
            >
              {renderList(false)}
              {renderList(true)}
            </Box>
          </>
        )}
        {mode === 'static' && renderList(false)}
        {mode === 'rotate' && (
          <Box component="ul" aria-label="Scoreboard ticker" data-testid="ticker-list" sx={{ ...listSx, position: 'static', display: 'block', width: '100%', minWidth: 0 }}>
            {items.map((item, position) => (
              <Box
                component="li"
                key={itemKey(item)}
                data-current={position === current ? 'true' : 'false'}
                sx={position === current ? { display: 'flex', justifyContent: 'center', minWidth: 0 } : visuallyHidden}
              >
                <Entry item={item} rules={kinds[item.kind] as TickerKindRules} truncate />
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', px: 0.5, gap: 0.25 }}>
        {mode === 'rotate' && (
          <IconButton aria-label="Previous Item" onClick={() => setIndex((current + count - 1) % count)} sx={controlSx}>
            <SkipPreviousIcon />
          </IconButton>
        )}
        <IconButton aria-label={userPaused ? 'Play Ticker' : 'Pause Ticker'} aria-pressed={userPaused} onClick={() => setUserPaused((value) => !value)} sx={controlSx}>
          {userPaused ? <PlayArrowIcon /> : <PauseIcon />}
        </IconButton>
        {mode === 'rotate' && (
          <IconButton aria-label="Next Item" onClick={() => setIndex((current + 1) % count)} sx={controlSx}>
            <SkipNextIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}
