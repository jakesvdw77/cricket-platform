import { alpha, Box, ButtonBase, Card as MuiCard, Skeleton, Typography } from '@mui/material'
import type { Theme } from '@mui/material'
import { compactCardSx, compactValueSx, keyFigureCardSx, keyFigureValueSx, selectableCardSx } from './keyFigureStyle'

export interface PageCounterItem {
  id: string
  value: string | number
  label: string
  tone?: 'default' | 'warning'
  // Small call to action shown on a selectable counter, e.g. "Tap to filter".
  hint?: string
  // Marks the counter the list below is currently filtered to.
  active?: boolean
  // Makes the counter a real button.
  onSelect?: () => void
  // docs/specs/084: what selecting does. 'filter' (default) toggles a filter of the list below: a toggle button
  // (aria-pressed) with a small "filter" tag. 'reset' is the same toggle behaviour without the tag (the card that
  // clears the filters). 'drill' opens something else: a plain button with a ">" marker, no aria-pressed.
  kind?: 'filter' | 'reset' | 'drill'
}

export interface PageCountersProps {
  items: PageCounterItem[]
  loading?: boolean
  // docs/specs/085: 'comfortable' (default, the Overview key-figure look) or 'compact' (one line, about 44 px,
  // 6 px gap). Only the Availability Polls page uses compact.
  density?: 'comfortable' | 'compact'
}

const SKELETON_COUNT = 4

const gridSx = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
}
const compactGridSx = { ...gridSx, gap: 0.75 }

// Screen-reader-only text (the visible cue is the corner marker).
const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const

const activeOutline = (theme: Theme) => `2px solid ${alpha(theme.palette.primary.main, 0.55)}`

// A counter with nothing behind it (figure 0) is a plain card, except the one the list is currently filtered to.
function isInteractive(item: PageCounterItem) {
  if (!item.onSelect) return false
  // 0, "0" and "0 / 24" are zero; "10 / 24" and "0.5" are not.
  const zero = /^0(\s*\/.*)?$/.test(String(item.value).trim())
  return !zero || Boolean(item.active)
}

// The corner marker of a selectable counter: a tag for a filter, a chevron for a drill-down. Decorative - the
// hint text (visually hidden) carries the meaning for assistive technology.
const markerSx = {
  position: 'absolute',
  top: 8,
  right: 10,
  color: 'primary.main',
  fontWeight: 700,
  lineHeight: 1,
}

function CounterBody({ item, interactive, compact }: { item: PageCounterItem; interactive: boolean; compact: boolean }) {
  const kind = item.kind ?? 'filter'
  return (
    <>
      {interactive && kind !== 'reset' && (
        <Box
          component="span"
          aria-hidden
          data-testid={`page-counter-${item.id}-marker`}
          sx={
            compact
              ? { ...markerSx, top: '50%', transform: 'translateY(-50%)', right: 10, ...(kind === 'drill' ? { fontSize: '1.15rem' } : { fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em' }) }
              : kind === 'drill'
                ? { ...markerSx, fontSize: '1.2rem' }
                : { ...markerSx, top: 9, fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.06em' }
          }
        >
          {kind === 'drill' ? '›' : 'filter'}
        </Box>
      )}
      <Typography component="b" data-testid="page-counter-value" sx={compact ? compactValueSx(item.tone === 'warning') : keyFigureValueSx(item.tone === 'warning')}>
        {item.value}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={compact ? { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}
        title={compact ? item.label : undefined}
      >
        {item.label}
      </Typography>
      {interactive && item.hint && (
        <Typography variant="caption" sx={visuallyHidden}>
          {item.hint}
        </Typography>
      )}
    </>
  )
}

// docs/specs/081: a row of counters under a page header, in the Overview key-figure card style. Four across
// from md, two by two below. A counter with onSelect is a real toggle button; others are plain cards.
export function PageCounters({ items, loading = false, density = 'comfortable' }: PageCountersProps) {
  const compact = density === 'compact'
  const cardSx = compact ? compactCardSx : keyFigureCardSx
  // Room for the corner marker on a selectable compact card, so it never overlaps the text.
  const markerPr = (item: PageCounterItem) => (compact && isInteractive(item) && (item.kind ?? 'filter') !== 'reset' ? { pr: item.kind === 'drill' ? 4 : 6.5 } : {})
  if (loading) {
    return (
      <Box sx={compact ? compactGridSx : gridSx} aria-busy="true" data-testid="page-counters-loading">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <MuiCard key={index} sx={cardSx}>
            <Skeleton variant="rounded" width={compact ? 24 : '40%'} height={compact ? 20 : 28} />
            <Skeleton variant="text" width={compact ? '55%' : '70%'} sx={compact ? { flex: 1 } : undefined} />
          </MuiCard>
        ))}
      </Box>
    )
  }

  return (
    <Box sx={compact ? compactGridSx : gridSx}>
      {items.map((item) =>
        isInteractive(item) ? (
          <ButtonBase
            key={item.id}
            onClick={item.onSelect}
            aria-pressed={(item.kind ?? 'filter') !== 'drill' ? Boolean(item.active) : undefined}
            data-testid={`page-counter-${item.id}`}
            data-active={item.active ? 'true' : undefined}
            sx={(theme) => ({
                ...cardSx,
                ...markerPr(item),
                borderRadius: `${theme.shape.borderRadius}px`,
                position: 'relative',
                alignItems: compact ? 'baseline' : 'flex-start',
                justifyContent: compact ? 'flex-start' : undefined,
                textAlign: 'left',
                outline: item.active ? activeOutline(theme) : '2px solid transparent',
                ...selectableCardSx(theme),
                '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
              })}
          >
            <CounterBody item={item} interactive={isInteractive(item)} compact={compact} />
          </ButtonBase>
        ) : (
          <MuiCard
            key={item.id}
            data-testid={`page-counter-${item.id}`}
            data-active={item.active ? 'true' : undefined}
            sx={(theme) => ({ ...cardSx, outline: item.active ? activeOutline(theme) : '2px solid transparent' })}
          >
            <CounterBody item={item} interactive={isInteractive(item)} compact={compact} />
          </MuiCard>
        ),
      )}
    </Box>
  )
}
