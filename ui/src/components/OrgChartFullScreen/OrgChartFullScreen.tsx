import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Button, Dialog, IconButton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import FitScreenOutlinedIcon from '@mui/icons-material/FitScreenOutlined'
import RemoveIcon from '@mui/icons-material/Remove'
import { ZOOM_MAX, ZOOM_MIN, fitScale, stepZoom } from '../../utils/chartZoom'
import type { Size } from '../../utils/chartZoom'

export interface OrgChartFullScreenProps {
  open: boolean
  onClose: () => void
  title: string
  // The chart. It is scaled as a whole; it keeps its own behaviour (selection and so on).
  children: ReactNode
}

const PADDING = 16
const TITLE_ID = 'org-chart-full-screen-title'
const UNMEASURED: Size = { width: 0, height: 0 }

// Keeps the previous object when nothing changed, so a repeated measurement never re-renders.
const keep = (next: Size) => (previous: Size) =>
  previous.width === next.width && previous.height === next.height ? previous : next

// A full-screen overlay for a read-only org chart with zoom (50 to 200 percent in 10 percent steps) and Fit to screen. It
// opens in Fit mode and re-fits as the window changes; a manual zoom leaves Fit mode. The chart is scaled with a CSS
// transform inside a box sized to the scaled chart, so the overlay scrolls both ways correctly when it does not fit and
// centres the chart when it does. Escape, the Close button and focus handling come with the MUI Dialog.
export function OrgChartFullScreen({ open, onClose, title, children }: OrgChartFullScreenProps) {
  const [viewport, setViewport] = useState<HTMLElement | null>(null)
  const [chart, setChart] = useState<HTMLElement | null>(null)
  const [available, setAvailable] = useState<Size>(UNMEASURED)
  const [natural, setNatural] = useState<Size>(UNMEASURED)
  const [fit, setFit] = useState(true)
  const [zoom, setZoom] = useState(1)

  // Every time the overlay opens it starts in Fit mode again.
  useEffect(() => {
    if (open) {
      setFit(true)
    }
  }, [open])

  const measure = useCallback(() => {
    if (viewport) {
      setAvailable(keep({ width: viewport.clientWidth - PADDING * 2, height: viewport.clientHeight - PADDING * 2 }))
    }
    if (chart) {
      setNatural(keep({ width: chart.offsetWidth, height: chart.offsetHeight }))
    }
  }, [viewport, chart])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    // jsdom has no ResizeObserver; the window listener and the first measure are enough there.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (observer) {
      if (viewport) observer.observe(viewport)
      if (chart) observer.observe(chart)
    }
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [measure, viewport, chart])

  const scale = fit ? fitScale(natural, available) : zoom
  const percent = Math.round(scale * 100)

  const changeZoom = (direction: 'in' | 'out') => {
    setZoom(stepZoom(scale, direction))
    setFit(false)
  }

  const measured = natural.width > 0 && natural.height > 0

  return (
    <Dialog fullScreen open={open} onClose={onClose} aria-labelledby={TITLE_ID}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 1 },
          flexWrap: 'wrap',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flex: 'none',
        }}
      >
        <Typography id={TITLE_ID} variant="h6" component="h2" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
        <IconButton aria-label="Zoom out" onClick={() => changeZoom('out')} disabled={scale <= ZOOM_MIN} size="small">
          <RemoveIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" aria-live="polite" sx={{ minWidth: 44, textAlign: 'center' }} data-testid="zoom-percent">
          {`${percent}%`}
        </Typography>
        <IconButton aria-label="Zoom in" onClick={() => changeZoom('in')} disabled={scale >= ZOOM_MAX} size="small">
          <AddIcon fontSize="small" />
        </IconButton>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FitScreenOutlinedIcon fontSize="small" />}
          onClick={() => setFit(true)}
        >
          Fit to screen
        </Button>
        <Button variant="text" color="inherit" size="small" startIcon={<CloseIcon fontSize="small" />} onClick={onClose}>
          Close
        </Button>
      </Box>

      <Box ref={setViewport} sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: `${PADDING}px`, bgcolor: 'background.default' }}>
        <Box
          sx={{
            mx: 'auto',
            width: measured ? natural.width * scale : 'max-content',
            height: measured ? natural.height * scale : 'auto',
          }}
        >
          <Box
            ref={setChart}
            data-testid="org-chart-full-screen-canvas"
            sx={{ width: 'max-content', transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}
