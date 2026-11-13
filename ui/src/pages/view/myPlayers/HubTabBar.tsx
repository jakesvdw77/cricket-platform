import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'

// The Hub's pill row as a tablist (docs/specs/123, generalised for docs/specs/148): arrow keys wrap, roving tabindex, an optional count badge.
// `idPrefix` makes the tab and panel ids (`${idPrefix}-tab-x`, `${idPrefix}-panel-x`).
export const hubTabId = (idPrefix: string, id: string) => `${idPrefix}-tab-${id}`
export const hubPanelId = (idPrefix: string, id: string) => `${idPrefix}-panel-${id}`

export interface HubTabBarProps<T extends string> {
  tabs: readonly { id: T; label: string }[]
  value: T
  onChange: (tab: T) => void
  counts?: Partial<Record<T, number>>
  ariaLabel: string
  idPrefix: string
}

export function HubTabBar<T extends string>({ tabs, value, onChange, counts, ariaLabel, idPrefix }: HubTabBarProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const index = tabs.findIndex((tab) => tab.id === value)
    const next = tabs[(index + step + tabs.length) % tabs.length]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      sx={{ display: 'flex', gap: 1, overflowX: 'auto', minWidth: 0, maxWidth: '100%', py: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value
        const count = counts?.[tab.id]
        return (
          <ButtonBase
            key={tab.id}
            ref={(node) => { refs.current[tab.id] = node }}
            role="tab"
            id={hubTabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={hubPanelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            sx={{
              flex: 'none',
              minHeight: 44,
              px: 2,
              gap: 1,
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 15,
              whiteSpace: 'nowrap',
              color: selected ? HUB.ink : HUB.cream,
              bgcolor: selected ? HUB.gold : 'transparent',
              border: `1px solid ${selected ? HUB.gold : HUB.line}`,
              borderRadius: 999,
              '&:hover': { bgcolor: selected ? HUB.gold : alpha(HUB.gold, 0.12) },
              '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
            }}
          >
            {tab.label}
            {count !== undefined && (
              <Box component="span" aria-hidden sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, bgcolor: selected ? alpha(HUB.ink, 0.22) : creamAlpha(0.16) }}>
                {count}
              </Box>
            )}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
