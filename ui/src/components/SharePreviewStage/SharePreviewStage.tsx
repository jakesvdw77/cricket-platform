import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import { Button } from '../Button'
import { ShareFillContext } from '../ShareFormatScreen/ShareFillContext'

const ZOOM_MIN = 50
const ZOOM_MAX = 300
const ZOOM_STEP = 25
// The largest backing store (in device pixels) a zoomed preview asks for, so a 300 percent A4 page stays drawable.
const MAX_BACKING_WIDTH = 4096
const DEFAULT_FIT_MAX_WIDTH = 560
const DEFAULT_BASE_WIDTH = 560

export interface SharePreviewView {
  // The width the preview should be on screen, in CSS pixels.
  width: number
  // The width to draw its canvas at, in device pixels (width x devicePixelRatio, capped), so zoomed text is redrawn sharp.
  pixelWidth: number
  // 'fit' or the percentage.
  zoom: 'fit' | number
}

export interface SharePreviewStageProps {
  // The preview itself (a canvas, a page image, a phone-style text box). With `zoomable` it may be a function of the view.
  children: ReactNode | ((view: SharePreviewView) => ReactNode)
  // One line under the stage saying what the preview is.
  caption?: ReactNode
  // Accessible name of the stage region.
  ariaLabel?: string
  // Shows the zoom toolbar (Zoom out, Zoom in, Fit, 100%) and lets the stage scroll inside itself.
  zoomable?: boolean
  // CSS width of the preview at 100 percent.
  baseWidth?: number
  // The widest the preview gets in Fit mode.
  fitMaxWidth?: number
  // Controls that belong with the preview but must not scroll with it (for example page buttons).
  footer?: ReactNode
  // Page height divided by page width (A4: 1.414, square poster: 1). Where the dialog gives the stage a fixed height, Fit
  // then sizes the page to the width and the height available; without it Fit is by width only.
  fitAspect?: number
  // Told the view whenever it changes, for screens whose drawing happens outside the stage (the PDF preview hook).
  onViewChange?: (view: SharePreviewView) => void
}

const clampZoom = (value: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))

// docs/specs/114-share-result.md (Preview and delivery): the checkerboard stage every format's preview sits on, with a
// caption. It scrolls inside itself only (a wide A4 page), never forcing a horizontal scroll on the page. With `zoomable` it
// offers zoom (50 to 300 percent in 25 steps, Fit, 100%) by telling the preview what size to draw at, so text stays sharp.
export function SharePreviewStage({
  children,
  caption,
  ariaLabel = 'Preview',
  zoomable = false,
  baseWidth = DEFAULT_BASE_WIDTH,
  fitMaxWidth = DEFAULT_FIT_MAX_WIDTH,
  footer,
  fitAspect,
  onViewChange,
}: SharePreviewStageProps) {
  const fill = useContext(ShareFillContext)
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [available, setAvailable] = useState(fitMaxWidth)
  const [availableHeight, setAvailableHeight] = useState<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!zoomable || !stage || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const style = window.getComputedStyle(stage)
      const inner = stage.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')
      if (inner > 0) setAvailable(inner)
      const innerHeight = stage.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0')
      if (innerHeight > 0) setAvailableHeight(innerHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [zoomable])

  const step = useCallback((delta: number) => setZoom((current) => clampZoom((current === 'fit' ? 100 : current) + delta)), [])

  // Ctrl or Cmd plus the wheel zooms the preview instead of the page. Needs a non-passive listener to cancel the browser zoom.
  useEffect(() => {
    const stage = stageRef.current
    if (!zoomable || !stage) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      step(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [zoomable, step])

  const onKeyDown = (event: KeyboardEvent) => {
    if (!zoomable || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === '+' || event.key === '=') step(ZOOM_STEP)
    else if (event.key === '-') step(-ZOOM_STEP)
    else if (event.key === '0') setZoom('fit')
    else return
    event.preventDefault()
  }

  const fitWidth = Math.min(available, fitMaxWidth)
  // A page that has a known shape also has to fit the stage's height (minus a hair so no scrollbar appears at Fit).
  const fitByHeight = fill && fitAspect && availableHeight ? Math.floor((availableHeight - 1) / fitAspect) : Infinity
  const width = !zoomable || zoom === 'fit' ? Math.max(1, Math.min(fitWidth, fitByHeight)) : (baseWidth * zoom) / 100
  const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const pixelWidth = Math.round(Math.min(width * ratio, Math.max(MAX_BACKING_WIDTH, width)))
  const view: SharePreviewView = { width, pixelWidth, zoom }
  useEffect(() => {
    onViewChange?.({ width, pixelWidth, zoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, pixelWidth, zoom])
  const label = zoom === 'fit' ? 'Fit' : `${zoom}%`
  const buttonSx = { minWidth: 44 }

  return (
    <Box sx={{ minWidth: 0, ...(fill ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : {}) }}>
      {zoomable && (
        <Box
          role="toolbar"
          aria-label="Zoom"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 0.5,
            mb: 1,
          }}
        >
          <Button
            size="compact"
            variant="secondary"
            aria-label="Zoom out"
            disabled={zoom !== 'fit' && zoom <= ZOOM_MIN}
            onClick={() => step(-ZOOM_STEP)}
            sx={buttonSx}
          >
            <ZoomOutIcon fontSize="small" />
          </Button>
          <Button
            size="compact"
            variant="secondary"
            aria-label="Zoom in"
            disabled={zoom !== 'fit' && zoom >= ZOOM_MAX}
            onClick={() => step(ZOOM_STEP)}
            sx={buttonSx}
          >
            <ZoomInIcon fontSize="small" />
          </Button>
          <Button
            size="compact"
            variant={zoom === 'fit' ? 'primary' : 'secondary'}
            aria-label="Fit to width"
            aria-pressed={zoom === 'fit'}
            onClick={() => setZoom('fit')}
            sx={buttonSx}
          >
            Fit
          </Button>
          <Button
            size="compact"
            variant={zoom === 100 ? 'primary' : 'secondary'}
            aria-label="Zoom to 100%"
            aria-pressed={zoom === 100}
            onClick={() => setZoom(100)}
            sx={buttonSx}
          >
            100%
          </Button>
          <Typography variant="body2" color="text.secondary" role="status" aria-live="polite" sx={{ ml: 0.5 }}>
            <Box component="span" sx={visuallyHidden}>
              Zoom{' '}
            </Box>
            {label}
          </Typography>
        </Box>
      )}
      <Box
        ref={stageRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={zoomable ? 0 : undefined}
        onKeyDown={zoomable ? onKeyDown : undefined}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'flex-start',
          p: { xs: 1.5, sm: 2.5 },
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          overflow: 'auto',
          maxWidth: '100%',
          maxHeight: fill ? undefined : zoomable && zoom !== 'fit' ? '70vh' : undefined,
          ...(fill ? { flex: 1, minHeight: 0 } : {}),
          backgroundColor: theme.palette.background.paper,
          backgroundImage: `conic-gradient(${alpha(theme.palette.text.primary, 0.05)} 25%, transparent 0 50%, ${alpha(theme.palette.text.primary, 0.05)} 0 75%, transparent 0)`,
          backgroundSize: '16px 16px',
        })}
      >
        {zoomable ? (
          // margin auto centres a narrow preview and still lets a wide one scroll from its left edge.
          <Box sx={{ width, flexShrink: 0, mx: 'auto' }}>{typeof children === 'function' ? children(view) : children}</Box>
        ) : (
          <Box sx={{ width: '100%', maxWidth: 560, minWidth: 0, mx: 'auto' }}>
            {typeof children === 'function' ? children(view) : children}
          </Box>
        )}
      </Box>
      {footer}
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}

const visuallyHidden = {
  position: 'absolute',
  // Pixel strings: a bare 1 in sx means 100 percent, which made this span as wide as the dialog and forced a horizontal scrollbar.
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const
