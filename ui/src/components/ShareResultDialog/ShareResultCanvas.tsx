import { Box } from '@mui/material'
import type { RefObject } from 'react'

export interface ShareResultCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  // "Result card: Riverside 1st XI won by 5 wickets"
  ariaLabel: string
  // Story is tall, so it is held narrower to stay in view.
  maxWidth?: number
  // When zoomed, the exact on-screen width in CSS pixels (the stage then scrolls); otherwise it fills the stage.
  width?: number
}

// The live preview: the generator's own full-size canvas, scaled down to the stage width (never wider, so no horizontal scroll).
export function ShareResultCanvas({ canvasRef, ariaLabel, maxWidth, width }: ShareResultCanvasProps) {
  return (
    <Box
      component="canvas"
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      sx={{
        display: 'block',
        width: width ?? '100%',
        maxWidth: width ? 'none' : (maxWidth ?? '100%'),
        height: 'auto',
        mx: 'auto',
        borderRadius: 1,
        boxShadow: 2,
      }}
    />
  )
}
