import { alpha, Box, ButtonBase, Card as MuiCard, Skeleton, Typography } from '@mui/material'
import type { Theme } from '@mui/material'
import { keyFigureCardSx, keyFigureValueSx } from './keyFigureStyle'

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
}

export interface PageCountersProps {
  items: PageCounterItem[]
  loading?: boolean
}

const SKELETON_COUNT = 4

const gridSx = {
  display: 'grid',
  gap: 1.5,
  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
}

const activeOutline = (theme: Theme) => `2px solid ${alpha(theme.palette.primary.main, 0.55)}`

function CounterBody({ item }: { item: PageCounterItem }) {
  return (
    <>
      <Typography component="b" data-testid="page-counter-value" sx={keyFigureValueSx(item.tone === 'warning')}>
        {item.value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {item.label}
      </Typography>
      {item.onSelect && item.hint && (
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, fontSize: '0.66rem' }}>
          {item.hint}
        </Typography>
      )}
    </>
  )
}

// docs/specs/081: a row of counters under a page header, in the Overview key-figure card style. Four across
// from md, two by two below. A counter with onSelect is a real toggle button; others are plain cards.
export function PageCounters({ items, loading = false }: PageCountersProps) {
  if (loading) {
    return (
      <Box sx={gridSx} aria-busy="true" data-testid="page-counters-loading">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <MuiCard key={index} sx={keyFigureCardSx}>
            <Skeleton variant="rounded" width="40%" height={28} />
            <Skeleton variant="text" width="70%" />
          </MuiCard>
        ))}
      </Box>
    )
  }

  return (
    <Box sx={gridSx}>
      {items.map((item) =>
        item.onSelect ? (
          <ButtonBase
            key={item.id}
            onClick={item.onSelect}
            aria-pressed={Boolean(item.active)}
            data-testid={`page-counter-${item.id}`}
            data-active={item.active ? 'true' : undefined}
            sx={(theme) => ({
                ...keyFigureCardSx,
                borderRadius: `${theme.shape.borderRadius}px`,
                alignItems: 'flex-start',
                textAlign: 'left',
                outline: item.active ? activeOutline(theme) : '2px solid transparent',
                '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
              })}
          >
            <CounterBody item={item} />
          </ButtonBase>
        ) : (
          <MuiCard
            key={item.id}
            data-testid={`page-counter-${item.id}`}
            data-active={item.active ? 'true' : undefined}
            sx={(theme) => ({ ...keyFigureCardSx, outline: item.active ? activeOutline(theme) : '2px solid transparent' })}
          >
            <CounterBody item={item} />
          </MuiCard>
        ),
      )}
    </Box>
  )
}
