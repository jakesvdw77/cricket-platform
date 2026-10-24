import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { bubblePill, isParent } from './hubNav'
import type { HubNavItem, HubPillCounts } from './hubNav'
import { HUB } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'

// docs/specs/121: one level of the Player Hub menu (the main list, or a parent's children, never both). A `nav` holding a
// `ul` of buttons (not role="menu": it navigates, it does not run commands). One tab stop (roving tabindex), Up, Down, Home
// and End move focus, Enter or Space activates. A row is a leaf (a page, locked when Soon), a parent (opens its sub menu,
// chevron) or an action. State lives in the URL, so this component only reports what was chosen.
export interface HubMenuProps {
  items: HubNavItem[]
  // The leaf or child shown beside the menu (aria-current="page").
  selectedId?: string
  counts: HubPillCounts
  onSelect: (item: HubNavItem) => void
  // Changes when the list swaps (main menu to a sub menu and back), so the tab stop resets.
  levelKey: string
  // When set, focus moves to that row (the first child after opening a sub menu, the parent after going up).
  focusId?: string
}

function Pill({ children, dashed }: { children: string; dashed?: boolean }) {
  // A count ("1 open", "2 new") is shown as just the number in a round badge so it never competes with the label for
  // width; the row's accessible name still carries the full wording.
  const count = !dashed ? /^\d+/.exec(children)?.[0] : undefined
  return (
    <Box
      component="span"
      sx={{
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: count ? 22 : undefined,
        height: 22,
        px: count ? '6px' : '8px',
        borderRadius: 999,
        border: `1px ${dashed ? 'dashed' : 'solid'} currentColor`,
        textTransform: 'none',
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      {count ?? children}
    </Box>
  )
}

const barSx = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 1.25,
  textAlign: 'right',
  fontFamily: HUB.display,
  fontWeight: 600,
  fontSize: { xs: 22, md: 26 },
  lineHeight: 1.1,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: HUB.cream,
  bgcolor: blackAlpha(0.22),
  borderTop: `1px solid ${HUB.line}`,
  px: { xs: 2.25, md: 2.75 },
  py: 1.5,
  minHeight: { xs: 56, md: 64 },
  borderRadius: 0,
  '&:hover': { bgcolor: alpha(HUB.gold, 0.1) },
  '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2 },
  '@media (prefers-reduced-motion: no-preference)': { transition: 'background-color .15s, color .15s' },
} as const

export function HubMenu({ items, selectedId, counts, onSelect, levelKey, focusId }: HubMenuProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState<string | undefined>()
  // Keyed by the level so a stale tab stop from the other list is ignored.
  const [activeLevel, setActiveLevel] = useState(levelKey)
  const stored = activeLevel === levelKey ? active : undefined
  const tabStop = items.some((item) => item.id === stored) ? stored : (items.find((item) => item.id === selectedId)?.id ?? items[0]?.id)

  useEffect(() => {
    if (!focusId) return
    listRef.current?.querySelector<HTMLElement>(`[data-hub-item="${focusId}"]`)?.focus()
  }, [focusId, levelKey])

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-hub-item]') ?? [])
    if (rows.length === 0) return
    const current = rows.indexOf(document.activeElement as HTMLElement)
    let next = current
    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, current + 1)
    else if (event.key === 'ArrowUp') next = Math.max(0, current - 1)
    else if (event.key === 'Home') next = 0
    else next = rows.length - 1
    event.preventDefault()
    rows[next].focus()
  }

  return (
    <Box component="nav" aria-label="Player sections">
      <Box component="ul" ref={listRef} onKeyDown={onKeyDown} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {items.map((item, index) => {
          const parent = isParent(item)
          const pill = bubblePill(item, counts)
          const selected = item.id === selectedId && !parent
          const name = [item.label, pill, item.soon ? 'Soon, not available yet' : null, parent ? 'opens sub menu' : null].filter(Boolean).join(', ')
          return (
            <li key={item.id}>
              <ButtonBase
                data-hub-item={item.id}
                tabIndex={item.id === tabStop ? 0 : -1}
                onFocus={() => {
                  setActive(item.id)
                  setActiveLevel(levelKey)
                }}
                onClick={() => onSelect(item)}
                aria-current={selected ? 'page' : undefined}
                aria-label={name}
                sx={{
                  ...barSx,
                  ...(selected && { color: HUB.gold, bgcolor: alpha(HUB.gold, 0.16) }),
                  ...(item.soon && !selected && { opacity: 0.7 }),
                  ...(index === items.length - 1 && { borderBottom: `1px solid ${HUB.line}` }),
                }}
              >
                {/* The pill sits at the left edge so it never takes width from the label, which stays right aligned and on one
                    line; the chevron slot is always reserved so every label ends on the same vertical line. */}
                {pill ? <Pill>{pill}</Pill> : item.soon ? <Pill dashed>Soon</Pill> : null}
                <Box component="span" sx={{ flex: 1, minWidth: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </Box>
                <Box component="span" aria-hidden sx={{ flex: 'none', width: 20, display: 'flex', justifyContent: 'flex-end' }}>
                  {parent && <ChevronRightIcon sx={{ fontSize: 26, opacity: 0.8, mr: -0.5, flex: 'none' }} />}
                </Box>
              </ButtonBase>
            </li>
          )
        })}
      </Box>
    </Box>
  )
}
