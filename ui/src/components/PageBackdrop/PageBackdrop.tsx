import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import sceneUrl from '../../assets/cricket-scene.svg'
import { BRAND } from '../../brandTokens'

// Cricket-themed full-page backdrop for signed-in-but-not-in-the-app pages (docs/specs/119). Built in
// an original flat SVG scene (assets/cricket-scene.svg, brand palette only) over the dark green base of the
// Keycloak login theme, under a dark-green gradient for contrast. Nothing is fetched from a third party;
// `imageUrl` lets an owner supply their own photo instead, drawn behind a dark-green overlay. Decoration only (aria-hidden); forced-colors falls back to Canvas.
// eslint-disable-next-line react-refresh/only-export-components
export const BACKDROP_COLOURS = {
  green900: BRAND.green900,
  green800: BRAND.green800,
  green700: BRAND.green700,
  ink: BRAND.ink,
  gold: BRAND.gold,
  sand: BRAND.sand,
  cream: BRAND.cream,
}

const { green900 } = BACKDROP_COLOURS

export interface PageBackdropProps {
  children: ReactNode
  // Optional photo URL, drawn behind a rgba(11,61,38,0.72) overlay in place of the CSS shapes.
  imageUrl?: string
}

export function PageBackdrop({ children, imageUrl }: PageBackdropProps) {
  return (
    <Box
      data-testid="page-backdrop"
      sx={{
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: green900,
        color: BACKDROP_COLOURS.cream,
        '@media (forced-colors: active)': { bgcolor: 'Canvas', color: 'CanvasText', '& [data-backdrop-art]': { display: 'none' } },
      }}
    >
      {imageUrl ? (
        <>
          <Box
            aria-hidden
            data-backdrop-art
            sx={{ position: 'absolute', inset: 0, zIndex: -2, backgroundImage: `url("${imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <Box aria-hidden data-backdrop-art sx={{ position: 'absolute', inset: 0, zIndex: -1, bgcolor: 'rgba(11,61,38,0.72)' }} />
        </>
      ) : (
        <>
          <Box
            aria-hidden
            data-backdrop-art
            sx={{ position: 'absolute', inset: 0, zIndex: -2, backgroundImage: `url("${sceneUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center bottom', backgroundRepeat: 'no-repeat' }}
          />
          <Box
            aria-hidden
            data-backdrop-art
            sx={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(11,61,38,0.85) 0%, rgba(11,61,38,0.35) 40%, rgba(11,61,38,0.1) 100%)' }}
          />
        </>
      )}
      {children}
    </Box>
  )
}
