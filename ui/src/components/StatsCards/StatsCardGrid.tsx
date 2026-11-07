import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Fade, useMediaQuery, useTheme } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { usePrefersReducedMotion } from '../FlipCard'
import { StatsCardShell } from './StatsCardShell'
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
// heights in rem (the variable --stats-card-h: 15rem normal, 10rem compact; a tall card spans two rows and the gap), so every card in
// a row has the same height and neither face can make it taller (the back scrolls inside the card). Below 600 px of content a card is
// at least that tall and may grow to fit its face. The rows lay out by the grid's own width (a container query, not the screen's,
// because the Hub's scope panel narrows the content): 3 columns from 880 px of content, pairs from 600 px, compact tiles 3 across from
// 880 px and 2 across from 600 px, otherwise one column.
// Expand: on desktop (md up) a card has an expand button; the card is then drawn a second time in an overlay that covers the grid's
// own area (not the whole app), with a Close button. The cards underneath are inert and hidden. Escape closes; focus moves into the overlay's
// Close button and returns to the expand button. The overlay card has its own flip state and gets `expanded` on its faces.
// The grid imports no card: the page hands it the cards (from the registry's cardsFor).
export const GROUP_PARAM = 'group'

const ROW_GAP = 1
// A lone card (or a lone last card) is capped so it never stretches across a desktop.
const SINGLE_MAX_WIDTH = 560
// Breathing room kept under an expanded card, in px.
const EXPANDED_BOTTOM_MARGIN = 8

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
function rowSx(kind: CardRowKind, count: number) {
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
  return { ...base, maxWidth: SINGLE_MAX_WIDTH }
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
        .map((def) => ({ def, state: def.state(payload, ctx), size: def.size ?? 'normal' }))
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

  // An expanded card fits the visible area exactly: scroll the content region to the top (the grid area then sits at its natural offset
  // under the header and pills), lock its scrolling while the card is open, and size the overlay to the region's height minus that offset.
  // Locking also stops the hidden cards from scrolling the page; the scroll position is restored on close.
  const expandedOpen = Boolean(expandedEntry)
  useEffect(() => {
    if (!expandedOpen) return undefined
    const area = areaRef.current
    const scroller = scrollParent(area)
    if (!area || !scroller) return undefined
    const savedTop = scroller.scrollTop
    const savedOverflow = scroller.style.overflowY
    scroller.scrollTop = 0
    scroller.style.overflowY = 'hidden'
    const measure = () => {
      const offset = area.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      setFitHeight(Math.max(240, Math.floor(scroller.clientHeight - offset - EXPANDED_BOTTOM_MARGIN)))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(scroller)
    return () => {
      observer?.disconnect()
      scroller.style.overflowY = savedOverflow
      scroller.scrollTop = savedTop
      setFitHeight(null)
    }
  }, [expandedOpen])

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

  const card = ({ def, state }: Resolved<P>, asExpanded: boolean) => (
    <StatsCardShell
      key={def.id}
      testId={asExpanded ? `card-${def.id}-expanded` : `card-${def.id}`}
      title={def.title(ctx)}
      tag={def.tag}
      state={state}
      whenMissing={def.whenMissing}
      scopeLabel={ctx.scopeLabel}
      basis={def.basis ? def.basis(payload, ctx) : basis}
      partialNote={def.partialNote?.(payload, ctx)}
      summary={def.summary(payload, ctx)}
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
      front={<def.Front payload={payload} ctx={ctx} state={state} expanded={asExpanded} />}
      back={<def.Back payload={payload} ctx={ctx} state={state} expanded={asExpanded} />}
    />
  )

  const rows = (entries: Resolved<P>[]) =>
    layoutRows(entries).map((row: CardRow<Resolved<P>>, rowIndex) => (
      <Box key={`${row.kind}-${row.cards[0].def.id}-${rowIndex}`} data-row={row.kind} sx={rowSx(row.kind, row.cards.length)}>
        {row.cards.map((entry, index) => (
          <Box key={entry.def.id} sx={cellSx(row.kind, index)}>
            {card(entry, false)}
          </Box>
        ))}
      </Box>
    ))

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
        {expandedEntry && (
          <Fade in appear timeout={reduced ? 0 : 220}>
            <Box
              role="region"
              aria-label={`${expandedEntry.def.title(ctx)}, expanded`}
              data-testid={`${testId}-expanded`}
              sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: fitHeight ?? '100%', zIndex: 5, minWidth: 0, display: 'grid', overflow: 'hidden' }}
            >
              {card(expandedEntry, true)}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  )
}
