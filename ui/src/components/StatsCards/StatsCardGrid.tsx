import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material'
import { useSearchParams } from 'react-router-dom'
import { StatsCardShell } from './StatsCardShell'
import { STATS_UI } from './statsCardStyle'
import type { CardCtx, CardState, StatsBasis, StatsCardDef, StatsGroupDef } from './statsCardTypes'

// docs/specs/147 section 2: lays the cards of one page out. Cards are laid out in a responsive grid, repeat(auto-fit, minmax(310px, 1fr)),
// so one card takes the width, two share it and there is never a lone card in a corner. From sm each group is a headed section (an h2
// per group, an h3 per card) in the groups' order, all visible. On a phone a pill row (supplied by the page as `renderGroupPicker`,
// the Hub passes HubPillStrip) selects one group at a time through `?group=`, the default being the first group with data. A group with
// no card to show has no heading or pill. The grid imports no card: the page hands it the cards (from the registry's cardsFor).
export const GROUP_PARAM = 'group'

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
  // The phone group selector; omitted, a phone shows every group stacked.
  renderGroupPicker?: (props: GroupPickerProps) => ReactNode
  testId?: string
}

interface Resolved<P> {
  def: StatsCardDef<P>
  state: CardState
}

const gridSx = { display: 'grid', gap: 1.75, minWidth: 0, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(310px, 1fr))' } } as const

export function StatsCardGrid<P>({ payload, ctx, cards, groups, basis = null, scopeKey, renderGroupPicker, testId = 'stats-card-grid' }: StatsCardGridProps<P>) {
  const [search, setSearch] = useSearchParams()
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'))

  // State is computed here, at render; a missing card that hides itself is not in the list, so its group can disappear.
  const resolved = useMemo<Resolved<P>[]>(
    () => cards.map((def) => ({ def, state: def.state(payload, ctx) })).filter((entry) => !(entry.state === 'missing' && entry.def.whenMissing === 'hide')),
    [cards, payload, ctx],
  )
  const visibleGroups = groups.filter((group) => resolved.some((entry) => entry.def.group === group.id))
  const firstWithData = visibleGroups.find((group) => resolved.some((entry) => entry.def.group === group.id && entry.state !== 'empty' && entry.state !== 'missing')) ?? visibleGroups[0]
  const requested = search.get(GROUP_PARAM)
  const selected = visibleGroups.find((group) => group.id === requested) ?? firstWithData
  const usePicker = phone && Boolean(renderGroupPicker) && visibleGroups.length > 0

  const select = (id: string) => {
    const params = new URLSearchParams(search)
    params.set(GROUP_PARAM, id)
    setSearch(params, { replace: true })
  }

  const card = ({ def, state }: Resolved<P>) => (
    <StatsCardShell
      key={def.id}
      testId={`card-${def.id}`}
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
      front={<def.Front payload={payload} ctx={ctx} state={state} />}
      back={<def.Back payload={payload} ctx={ctx} state={state} />}
    />
  )

  if (usePicker && selected) {
    const shown = resolved.filter((entry) => entry.def.group === selected.id)
    return (
      <Box data-testid={testId} sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}>
        {renderGroupPicker?.({ label: 'Card groups', items: visibleGroups.map((group) => ({ id: group.id, label: group.label })), selectedId: selected.id, onSelect: select })}
        <Box component="section" aria-label={selected.label} data-testid={`${testId}-group-${selected.id}`} sx={gridSx}>
          {shown.map(card)}
        </Box>
      </Box>
    )
  }

  return (
    <Box data-testid={testId} sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
      {visibleGroups.map((group) => (
        <Box key={group.id} component="section" aria-labelledby={`${testId}-heading-${group.id}`} data-testid={`${testId}-group-${group.id}`} sx={{ display: 'grid', gap: 1.5, minWidth: 0 }}>
          <Typography id={`${testId}-heading-${group.id}`} component="h2" sx={{ fontFamily: STATS_UI.display, fontSize: 22, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: STATS_UI.sand, m: 0 }}>
            {group.label}
          </Typography>
          <Box sx={gridSx}>{resolved.filter((entry) => entry.def.group === group.id).map(card)}</Box>
        </Box>
      ))}
    </Box>
  )
}
