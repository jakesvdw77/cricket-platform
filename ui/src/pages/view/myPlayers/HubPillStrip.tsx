import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { HubNavItem } from './hubNav'
import { HUB } from './hubStyle'
import { blackAlpha, creamAlpha } from '../../../brandTokens'
import { PulseDot } from '../../../components/RecordCard/RecordCard'

// Phone only: a parent's sub menu as a horizontally scrollable row of pills under the title. Real buttons, the open page has
// aria-current="page", a Soon pill is dashed and muted. Scrolls the selected pill into view on mount and on change.
// A pill may carry a small count badge and the pulsing live dot (the Matches pills).
export type HubPillItem = HubNavItem & { count?: number; live?: boolean }

export interface HubPillStripProps {
  label: string
  items: HubPillItem[]
  selectedId?: string
  onSelect: (item: HubNavItem) => void
  // The stats pages' group row: one slim row (32 px pills), no bar behind it and no rule under it.
  compact?: boolean
}

export function HubPillStrip({ label, items, selectedId, onSelect, compact = false }: HubPillStripProps) {
  const listRef = useRef<HTMLDivElement>(null)
  // A fade on the right edge while more pills are scrolled out of sight, so a cut pill reads as "scroll", not as clipped.
  const [moreRight, setMoreRight] = useState(false)
  const measure = useCallback(() => {
    const list = listRef.current
    if (list) setMoreRight(list.scrollLeft + list.clientWidth < list.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const list = listRef.current
    const selected = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !selected) return
    // Scroll the strip itself (not the page) so the selected pill is centred where it can be.
    list.scrollLeft = selected.offsetLeft - (list.clientWidth - selected.offsetWidth) / 2
    measure()
  }, [selectedId, measure])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure, items.length])

  return (
    <Box component="nav" aria-label={label} sx={{ minWidth: 0, maxWidth: '100%' }}>
      <Box
        ref={listRef}
        onScroll={measure}
        sx={{
          display: 'flex',
          minWidth: 0,
          maxWidth: '100%',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          ...(moreRight && { maskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)' }),
          gap: 1,
          overflowX: 'auto',
          ...(compact ? { px: 0, py: '2px' } : { px: 2, py: 1.5, bgcolor: blackAlpha(0.2) }),
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {items.map((item) => {
          const selected = item.id === selectedId
          return (
            <ButtonBase
              key={item.id}
              onClick={() => onSelect(item)}
              aria-current={selected ? 'page' : undefined}
              sx={{
                flex: 'none',
                minHeight: compact ? 32 : 40,
                px: compact ? 1.5 : 2,
                borderRadius: 999,
                border: `1px ${item.soon && !selected ? 'dashed' : 'solid'} ${selected ? HUB.gold : HUB.line}`,
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 14,
                whiteSpace: 'nowrap',
                color: selected ? HUB.ink : item.soon ? HUB.muted : HUB.cream,
                bgcolor: selected ? HUB.gold : 'transparent',
                '&:hover': { bgcolor: selected ? HUB.gold : alpha(HUB.gold, 0.12) },
                '&.Mui-focusVisible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 },
              }}
            >
              {item.live && <PulseDot />}
              {item.live && <Box component="span" sx={{ width: 6 }} />}
              {item.label}
              {item.count !== undefined && (
                <Box
                  component="span"
                  data-testid="pill-count"
                  sx={{ ml: 0.75, minWidth: 20, px: 0.5, borderRadius: 999, fontSize: 12, lineHeight: '18px', textAlign: 'center', bgcolor: selected ? alpha(HUB.ink, 0.18) : creamAlpha(0.14) }}
                >
                  {item.count}
                </Box>
              )}
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
