import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Box, ButtonBase, IconButton, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { blackAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'

// docs/specs/145 Decision 6 (Player Hub Results carousel): full-width cards that snap, with a gap wider than the page margin so no
// part of the next card shows. The cues that there is more: the counter ("1 / 6") with previous and next arrows, the dots, the
// "Next: ..." label on each card, swipe, and Left and Right on the focused region. The "All Cards" list below jumps to a card.
// More rows are the server's: reaching the last loaded card (or Show More) asks the page for the next page.
export interface CarouselItem {
  key: string
  // Short name for the "Next: ..." label and the All Cards list.
  label: string
  // A second line in the All Cards list (the date and result).
  hint?: string
  // The card; it is handed the Next control to draw at its foot (absent on the last card when nothing more can load).
  render: (next?: { label: string; onClick: () => void }) => ReactNode
}

export interface HubResultCarouselProps {
  items: CarouselItem[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  ariaLabel?: string
}

const GAP = 24

const arrowSx = {
  width: 40,
  height: 40,
  border: `1px solid ${HUB.lineSoft}`,
  bgcolor: blackAlpha(0.3),
  color: HUB.cream,
  '&:hover': { bgcolor: blackAlpha(0.45) },
  '&.Mui-disabled': { opacity: 0.3, color: HUB.cream },
  '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
} as const

const reducedMotion = (): boolean => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export function HubResultCarousel({ items, hasMore, loadingMore, onLoadMore, ariaLabel = 'Result Cards' }: HubResultCarouselProps) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = items.length

  const step = () => {
    const first = track.current?.children[0] as HTMLElement | undefined
    return first ? first.offsetWidth + GAP : 0
  }
  // `reveal` also brings the carousel into view first (the All Cards list sits below it). It is instant: a second smooth scroll started in the
  // same call can cancel the horizontal one, so only one smooth scroll (the strip) is ever running.
  const go = useCallback(
    (target: number, reveal = false) => {
      const el = track.current
      if (!el) return
      const next = Math.max(0, Math.min(count - 1, target))
      setIndex(next)
      if (reveal) el.scrollIntoView?.({ block: 'nearest', behavior: 'auto' })
      el.scrollTo?.({ left: step() * next, behavior: reducedMotion() ? 'auto' : 'smooth' })
    },
    [count],
  )

  const onScroll = () => {
    const width = step()
    if (!width || !track.current) return
    const current = Math.max(0, Math.min(count - 1, Math.round(track.current.scrollLeft / width)))
    setIndex((previous) => (previous === current ? previous : current))
  }

  // Reaching the last loaded card loads the next page.
  useEffect(() => {
    if (count > 0 && index >= count - 1 && hasMore && !loadingMore) onLoadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, hasMore, loadingMore])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(index + 1)
    }
  }

  const nextFor = (position: number) => {
    const following = items[position + 1]
    if (following) return { label: `Next: ${following.label} ›`, onClick: () => go(position + 1) }
    return hasMore ? { label: 'Load Earlier Results ›', onClick: onLoadMore } : undefined
  }

  return (
    // gridTemplateColumns minmax(0, 1fr): a grid column sizes to its contents by default, which stretched it to hold every card side by side and left the
    // strip nothing to scroll; with minmax(0, 1fr) the column is exactly the page width and the strip scrolls inside it.
    <Box data-testid="hub-result-carousel" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h3" sx={{ fontFamily: HUB.display, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 16, color: HUB.sand }}>
          Flip Through
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton aria-label="Previous Card" disabled={index <= 0} onClick={() => go(index - 1)} sx={arrowSx}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography aria-live="polite" data-testid="carousel-counter" sx={{ fontFamily: HUB.display, fontSize: 18, letterSpacing: '0.1em', color: HUB.muted, minWidth: 56, textAlign: 'center' }}>
            <Box component="b" sx={{ color: HUB.cream, fontSize: 22 }}>{Math.min(index + 1, count)}</Box> / {count}
            {hasMore ? '+' : ''}
          </Typography>
          <IconButton aria-label="Next Card" disabled={index >= count - 1 && !hasMore} onClick={() => (index >= count - 1 ? onLoadMore() : go(index + 1))} sx={arrowSx}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      <Box
        ref={track}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onScroll={onScroll}
        sx={{
          display: 'flex',
          minWidth: 0,
          maxWidth: '100%',
          gap: `${GAP}px`,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          alignItems: 'stretch',
          py: 0.5,
          '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2, borderRadius: '22px' },
          '& > *': { flex: '0 0 100%', scrollSnapAlign: 'start', minHeight: 460 },
        }}
      >
        {items.map((item, position) => (
          <Box key={item.key} role="group" aria-roledescription="slide" aria-label={`${position + 1} of ${count}`} sx={{ display: 'flex', flexDirection: 'column', '& > *': { flex: 1 } }}>
            {item.render(nextFor(position))}
          </Box>
        ))}
      </Box>

      <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', gap: '7px', pb: 0.5, flexWrap: 'wrap' }}>
        {items.map((item, position) => (
          <Box key={item.key} component="i" data-testid="carousel-dot" data-on={position === index} sx={{ width: position === index ? 20 : 7, height: 7, borderRadius: position === index ? '6px' : '50%', bgcolor: position === index ? HUB.gold : HUB.lineSoft, display: 'block' }} />
        ))}
      </Box>

      <Typography component="h3" sx={{ fontFamily: HUB.display, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 16, color: HUB.sand, mt: 1.5 }}>
        All Cards
      </Typography>
      <Box component="ul" data-testid="all-cards" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
        {items.map((item, position) => (
          <li key={item.key}>
            <ButtonBase
              onClick={() => go(position, true)}
              aria-current={position === index ? 'true' : undefined}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                textAlign: 'left',
                flexDirection: 'column',
                alignItems: 'flex-start',
                minHeight: 44,
                px: 1.75,
                py: 0.75,
                borderRadius: '14px',
                border: `1px solid ${position === index ? HUB.gold : HUB.lineSoft}`,
                bgcolor: blackAlpha(0.25),
                color: HUB.cream,
                fontSize: 15,
                '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
              }}
            >
              {item.label}
              {item.hint && <Box component="span" sx={{ color: HUB.muted, fontSize: 13 }}>{item.hint}</Box>}
            </ButtonBase>
          </li>
        ))}
      </Box>
      {hasMore && (
        <ButtonBase
          onClick={onLoadMore}
          disabled={loadingMore}
          sx={{ minHeight: 44, border: `1px solid ${HUB.line}`, borderRadius: '4px', fontSize: 15, fontWeight: 600, color: HUB.cream, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
        >
          {loadingMore ? 'Loading...' : 'Show More'}
        </ButtonBase>
      )}
    </Box>
  )
}
