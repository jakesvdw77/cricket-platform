import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND } from '../../brandTokens'

// The Cricket Legend mark (docs/standards/design-system.md, Brand mark): the green favicon tile with the cream bat and the
// red ball with a straight seam. It is drawn on its own green tile and NEVER on a white one (the cream bat vanishes on white).
// `edge` adds a thin light ring so the green tile stays visible on the dark green header.
export interface BrandMarkProps {
  size?: number
  edge?: boolean
}

export function BrandMark({ size = 32, edge = false }: BrandMarkProps) {
  return (
    <Box
      component="img"
      src="/favicon.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      data-testid="brand-mark"
      sx={{ display: 'block', flexShrink: 0, width: size, height: size, borderRadius: `${Math.round(size * 0.22)}px`, ...(edge && { boxShadow: `0 0 0 1.5px ${alpha(BRAND.cream, 0.55)}` }) }}
    />
  )
}
