import { useEffect, useRef } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { HubNavItem } from './hubNav'
import { HUB } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'

// Phone only: a parent's sub menu as a horizontally scrollable row of pills under the title. Real buttons, the open page has
// aria-current="page", a Soon pill is dashed and muted. Scrolls the selected pill into view on mount and on change.
export interface HubPillStripProps {
  label: string
  items: HubNavItem[]
  selectedId?: string
  onSelect: (item: HubNavItem) => void
}

export function HubPillStrip({ label, items, selectedId, onSelect }: HubPillStripProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    const selected = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !selected) return
    // Scroll the strip itself (not the page) so the selected pill is centred where it can be.
    list.scrollLeft = selected.offsetLeft - (list.clientWidth - selected.offsetWidth) / 2
  }, [selectedId])

  return (
    <Box component="nav" aria-label={label}>
      <Box
        ref={listRef}
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${HUB.line}`,
          bgcolor: blackAlpha(0.2),
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
                minHeight: 40,
                px: 2,
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
              {item.label}
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
