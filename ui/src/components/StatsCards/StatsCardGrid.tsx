import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Box, Fade, useMediaQuery, useTheme } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { usePrefersReducedMotion } from '../FlipCard'
import { STATS_UI } from './statsCardStyle'
import { StatsCardShell } from './StatsCardShell'
import { StatsFaceBoundary } from './StatsFaceBoundary'
import { layoutRows } from './statsCardOrder'
import { CARD_COMPACT_HEIGHT_REM, CARD_HEIGHT_REM, CARD_HEIGHT_VAR } from './statsCardStyle'
import type { CardRow, CardRowKind } from './statsCardOrder'
import type { CardCtx, CardSize, CardState, StatsBasis, StatsCardDef, StatsGroupDef } from './statsCardTypes'

// docs/specs/147 section 2 and Amendment 2 (items 2, 9, 10): lays the cards of one page out.
// Groups: the pill row (supplied by the page as `renderGroupPicker`, the Hub passes HubPillStrip) is the group selector on EVERY width;
// one group shows at a time through `?group=`, the default being the first group with data. A group with no card to show has no pill.
// A page with a single group shows no pill row.
// Rows: layoutRows turns the group's cards into rows of three cards, or a tall card beside two stacked ones, with a short last row of
// equal halves or one capped card, or rows of up to three compact tiles (the Summary, 3 + 3 + 2). Each row is its own CSS grid with FIXED row
// heights in rem (the variable --stats-card-h: 17rem normal, 15rem compact; a tall card spans two rows and the gap), so every card in
// a row has the same height and neither face can make it taller (the front never scrolls, the back scrolls inside the card). Below 600 px of content a card is
// at least that tall and may grow to fit its face. The rows lay out by the grid's own width (a container query, not the screen's,
// because the Hub's scope panel narrows the content): 3 columns from 880 px of content, pairs from 600 px, compact tiles 3 across from
// 880 px and 2 across from 600 px, otherwise one column.
// Expand: on desktop (md up) a card has an expand button; the card is then drawn a second time in an overlay that covers the whole
// Hub content region (portalled into the scrolling ancestor), opaque, with a Close button. Everything else in the region is inert and hidden. Escape closes; focus moves into the overlay's
// Close button and returns to the expand button. The overlay does not flip: it shows the card's Front and Back side by side (or the card's own `Expanded` face) at the expanded scale.
// The grid imports no card: the page hands it the cards (from the registry's cardsFor).
export const GROUP_PARAM = 'group'

const ROW_GAP = 1

// A card's pure functions read payload blocks an older backend may not send; a throw is "no value", never a crash.
function attempt<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch {
    return fallback
  }
}
// A lone card (or a lone last card) is capped so it never stretches across a desktop.
const SINGLE_MAX_WIDTH = 560

// The nearest ancestor that scrolls vertically (the Hub content section), or null.
function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let el = node?.parentElement ?? null; el; el = el.parentElement) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return el
  }
  return null
}

export interface GroupPickerProps {
  label: string
  items: { id: string; label: string }[]
  selectedId: string
  onSelect: (id: string) => void
}

export interface StatsCardGridProps<P> {
  payload: P
  ctx: CardCtx
  // Already in display order (cardsFor).
  cards: StatsCardDef<P>[]
  // The page's groups in display order.
  groups: StatsGroupDef[]
  // The page's "Based on N of M results" unless a card brings its own coverage.
  basis?: StatsBasis | null
  // A new scope puts every card back on its front.
  scopeKey?: string
  // The group selector; omitted, every group's rows follow one another.
  renderGroupPicker?: (props: GroupPickerProps) => ReactNode
  testId?: string
}

interface Resolved<P> {
  def: StatsCardDef<P>
  state: CardState
  size: CardSize
}

const ONE_COLUMN = 'minmax(0, 1fr)'
const THREE_UP = '@container (min-width: 880px)'
const TWO_UP = '@container (min-width: 600px)'

// The grid template of one row kind. A tall row is two columns by two equal rows; its first card spans both rows.
function rowSx(kind: CardRowKind, count: number, onlyRow = false) {
  const height = `${kind === 'compact' ? CARD_COMPACT_HEIGHT_REM : CARD_HEIGHT_REM}rem`
  const base = {
    display: 'grid',
    gap: ROW_GAP,
    minWidth: 0,
    gridTemplateColumns: ONE_COLUMN,
    [CARD_HEIGHT_VAR]: height,
    gridAutoRows: `minmax(var(${CARD_HEIGHT_VAR}), auto)`,
    [TWO_UP]: { gridAutoRows: `var(${CARD_HEIGHT_VAR})` },
  } as const
  if (kind === 'three') return { ...base, [THREE_UP]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoRows: `var(${CARD_HEIGHT_VAR})` } }
  if (kind === 'pair') return { ...base, [TWO_UP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoRows: `var(${CARD_HEIGHT_VAR})` } }
  if (kind === 'tall') {
    return { ...base, [THREE_UP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: `repeat(2, var(${CARD_HEIGHT_VAR}))`, gridAutoRows: `var(${CARD_HEIGHT_VAR})` } }
  }
  if (kind === 'compact') {
    return {
      ...base,
      [TWO_UP]: { gridTemplateColumns: `repeat(${Math.min(Math.max(count, 1), 2)}, minmax(0, 1fr))`, gridAutoRows: `var(${CARD_HEIGHT_VAR})` },
      [THREE_UP]: { gridTemplateColumns: `repeat(${Math.min(Math.max(count, 1), 3)}, minmax(0, 1fr))`, gridAutoRows: `var(${CARD_HEIGHT_VAR})` },
    }
  }
  // A group that is just one card (Fielding) is the single column at full width; a lone last card in a longer group stays capped.
  return onlyRow ? base : { ...base, maxWidth: SINGLE_MAX_WIDTH }
}

// Where a card sits in its row (only the tall row places cards explicitly).
function cellSx(kind: CardRowKind, index: number) {
  const base = { display: 'grid', minWidth: 0 } as const
  if (kind !== 'tall') return base
  if (index === 0) return { ...base, [THREE_UP]: { gridColumn: 1, gridRow: '1 / span 2' } }
  return { ...base, [THREE_UP]: { gridColumn: 2, gridRow: index } }
}

export function StatsCardGrid<P>({ payload, ctx, cards, groups, basis = null, scopeKey, renderGroupPicker, testId = 'stats-card-grid' }: StatsCardGridProps<P>) {
  const [search, setSearch] = useSearchParams()
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const reduced = usePrefersReducedMotion()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const areaRef = useRef<HTMLDivElement | null>(null)
  // The height of the visible inner area from the top of the grid area down; null when nothing is expanded or nothing scrolls.
  const [fitHeight, setFitHeight] = useState<number | null>(null)

  // State is computed here, at render; a missing card that hides itself is not in the list, so its group can disappear.
  const resolved = useMemo<Resolved<P>[]>(
    () =>
      cards
        .map((def) => ({ def, state: attempt<CardState>(() => def.state(payload, ctx), 'missing'), size: def.size ?? 'normal' }))
        .filter((entry) => !(entry.state === 'missing' && entry.def.whenMissing === 'hide')),
    [cards, payload, ctx],
  )
  const visibleGroups = groups.filter((group) => resolved.some((entry) => entry.def.group === group.id))
  const firstWithData = visibleGroups.find((group) => resolved.some((entry) => entry.def.group === group.id && entry.state !== 'empty' && entry.state !== 'missing')) ?? visibleGroups[0]
  const requested = search.get(GROUP_PARAM)
  const selected = visibleGroups.find((group) => group.id === requested) ?? firstWithData
  const usePicker = Boolean(renderGroupPicker) && visibleGroups.length > 1
  const shownGroups = usePicker && selected ? [selected] : visibleGroups

  const expandedEntry = desktop && expandedId ? resolved.find((entry) => entry.def.id === expandedId) : undefined

  const close = () => setExpandedId(null)

  // Escape closes the expanded card.
  useEffect(() => {
    if (!expandedId) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expandedId])

  // An expanded card covers the whole visible content region: the overlay is portalled into the nearest scrolling ancestor (the Hub content
  // section, made position: relative), absolute at inset 0, opaque and above everything. The region is scrolled to the top and its scrolling
  // locked while the card is open (the scroll position is restored on close), and every other child of the region is made inert and hidden,
  // so nothing prints through the overlay and nothing behind it takes focus. With no scrolling ancestor (stories, tests) the overlay falls
  // back to covering the grid's own area.
  const expandedOpen = Boolean(expandedEntry)
  const [overlay, setOverlay] = useState<{ host: HTMLElement | null } | null>(null)
  useLayoutEffect(() => {
    if (!expandedOpen) return undefined
    const scroller = scrollParent(areaRef.current)
    if (!scroller) {
      setOverlay({ host: null })
      return () => setOverlay(null)
    }
    const savedTop = scroller.scrollTop
    const savedOverflow = scroller.style.overflowY
    const savedPosition = scroller.style.position
    if (getComputedStyle(scroller).position === 'static') scroller.style.position = 'relative'
    scroller.scrollTop = 0
    scroller.style.overflowY = 'hidden'
    const host = document.createElement('div')
    host.setAttribute('data-testid', `${testId}-overlay-host`)
    Object.assign(host.style, { position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', zIndex: '20', boxSizing: 'border-box', padding: '16px 20px', display: 'grid', overflow: 'hidden', background: STATS_UI.expandedGround })
    scroller.appendChild(host)
    const hidden: { el: HTMLElement; visibility: string; inert: boolean }[] = []
    Array.from(scroller.children).forEach((child) => {
      if (child === host || !(child instanceof HTMLElement)) return
      hidden.push({ el: child, visibility: child.style.visibility, inert: child.hasAttribute('inert') })
      child.setAttribute('inert', '')
      child.style.visibility = 'hidden'
    })
    const measure = () => setFitHeight(Math.max(240, Math.floor(host.clientHeight - 32)))
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(host)
    setOverlay({ host })
    return () => {
      observer?.disconnect()
      hidden.forEach(({ el, visibility, inert }) => {
        el.style.visibility = visibility
        if (!inert) el.removeAttribute('inert')
      })
      host.remove()
      scroller.style.overflowY = savedOverflow
      scroller.style.position = savedPosition
      scroller.scrollTop = savedTop
      setFitHeight(null)
      setOverlay(null)
    }
  }, [expandedOpen, testId])

  // Focus goes back to the expand button that opened the card (the overlay is gone and the cards are no longer inert by now).
  useEffect(() => {
    if (expandedId === null && triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [expandedId])

  const select = (id: string) => {
    setExpandedId(null)
    triggerRef.current = null
    const params = new URLSearchParams(search)
    params.set(GROUP_PARAM, id)
    setSearch(params, { replace: true })
  }

  const card = ({ def, state }: Resolved<P>, asExpanded: boolean) => {
    const usable = state !== 'missing'
    const cardBasis = def.basis
    const own = cardBasis && usable ? attempt<StatsBasis | null>(() => cardBasis(payload, ctx), null) : null
    const fallback = def.missingText ?? 'The scorecard does not record this yet.'
    return (
    <StatsCardShell
      key={def.id}
      testId={asExpanded ? `card-${def.id}-expanded` : `card-${def.id}`}
      title={def.title(ctx)}
      tag={def.tag}
      state={state}
      whenMissing={def.whenMissing}
      scopeLabel={ctx.scopeLabel}
      basis={cardBasis && usable ? own : basis}
      partialNote={usable ? attempt<string | undefined>(() => def.partialNote?.(payload, ctx), undefined) : undefined}
      summary={usable ? attempt(() => def.summary(payload, ctx), def.title(ctx)) : def.title(ctx)}
      emptyText={def.emptyText}
      missingText={def.missingText}
      scopeKey={scopeKey}
      expanded={asExpanded}
      onClose={asExpanded ? close : undefined}
      onExpand={
        desktop && !asExpanded
          ? (trigger) => {
              triggerRef.current = trigger
              setExpandedId(def.id)
            }
          : undefined
      }
      expandedBody={asExpanded && def.Expanded ? <StatsFaceBoundary text={fallback}><def.Expanded payload={payload} ctx={ctx} state={state} expanded /></StatsFaceBoundary> : undefined}
      front={<StatsFaceBoundary text={fallback}><def.Front payload={payload} ctx={ctx} state={state} expanded={asExpanded} /></StatsFaceBoundary>}
      back={<StatsFaceBoundary text={fallback}><def.Back payload={payload} ctx={ctx} state={state} expanded={asExpanded} /></StatsFaceBoundary>}
    />
    )
  }

  const rows = (entries: Resolved<P>[]) => {
    const laid = layoutRows(entries)
    return laid.map((row: CardRow<Resolved<P>>, rowIndex) => (
      <Box key={`${row.kind}-${row.cards[0].def.id}-${rowIndex}`} data-row={row.kind} sx={rowSx(row.kind, row.cards.length, laid.length === 1)}>
        {row.cards.map((entry, index) => (
          <Box key={entry.def.id} sx={cellSx(row.kind, index)}>
            {card(entry, false)}
          </Box>
        ))}
      </Box>
    ))
  }

  return (
    <Box data-testid={testId} sx={{ display: 'grid', gap: ROW_GAP, minWidth: 0 }}>
      {usePicker && selected && renderGroupPicker?.({ label: 'Card groups', items: visibleGroups.map((group) => ({ id: group.id, label: group.label })), selectedId: selected.id, onSelect: select })}
      <Box data-testid={`${testId}-area`} ref={areaRef} sx={{ position: 'relative', minWidth: 0, containerType: 'inline-size' }}>
        <Box inert={expandedEntry ? true : undefined} sx={{ display: 'grid', gap: 2, minWidth: 0, visibility: expandedEntry ? 'hidden' : 'visible' }}>
          {shownGroups.map((group) => (
            <Box key={group.id} component="section" aria-label={group.label} data-testid={`${testId}-group-${group.id}`} sx={{ display: 'grid', gap: ROW_GAP, minWidth: 0 }}>
              {rows(resolved.filter((entry) => entry.def.group === group.id))}
            </Box>
          ))}
        </Box>
        {expandedEntry && overlay && (overlay.host
          ? createPortal(
              <Fade in appear timeout={reduced ? 0 : 220}>
                <Box
                  role="region"
                  aria-label={`${expandedEntry.def.title(ctx)}, expanded`}
                  data-testid={`${testId}-expanded`}
                  sx={{ height: '100%', minWidth: 0, minHeight: 0, display: 'grid', overflow: 'hidden', '--stats-exp-h': fitHeight ? `${fitHeight}px` : '560px' }}
                >
                  {card(expandedEntry, true)}
                </Box>
              </Fade>,
              overlay.host,
            )
          : (
              <Fade in appear timeout={reduced ? 0 : 220}>
                <Box
                  role="region"
                  aria-label={`${expandedEntry.def.title(ctx)}, expanded`}
                  data-testid={`${testId}-expanded`}
                  sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', zIndex: 5, minWidth: 0, display: 'grid', overflow: 'hidden', bgcolor: STATS_UI.expandedGround, '--stats-exp-h': '560px' }}
                >
                  {card(expandedEntry, true)}
                </Box>
              </Fade>
            ))}
      </Box>
    </Box>
  )
}
