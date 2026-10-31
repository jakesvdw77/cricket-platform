import { useState } from 'react'
import { Avatar } from '@mui/material'
import type { AvatarProps, SxProps, Theme } from '@mui/material'
import { avatarSx } from '../RecordCard/avatarSx'

export interface LogoAvatarProps extends Omit<AvatarProps, 'sx' | 'src'> {
  src?: string | null
  size: number
  fontSize?: string
  // 'record' (default): league, team, field, sponsor, soft green tint fallback. 'person': player or contact, gold disc fallback.
  kind?: 'record' | 'person'
  // Extra styling in every state (radius, responsive size, ring).
  sx?: SxProps<Theme>
  // Extra styling only while the gold tile shows (no src, loading or failed), e.g. a muted opponent look.
  fallbackSx?: SxProps<Theme>
  // Keep the tile even when the image loads (a stock gender icon that is not a real photo).
  keepTile?: boolean
}

// A logo or photo avatar. The fallback tile (gold for a person, soft green tint for a record) shows while there is no image,
// while it loads and when it fails to load; the tile is dropped (transparent, object-fit contain) ONLY once the image
// has actually loaded, so transparent logo corners show no gold and a broken URL never leaves invisible initials.
export function LogoAvatar({ src, size, fontSize, kind = 'record', sx, fallbackSx, keepTile, imgProps, children, ...rest }: LogoAvatarProps) {
  const [state, setState] = useState<{ src: string; status: 'loaded' | 'error' } | null>(null)
  const loaded = !keepTile && Boolean(src) && state?.src === src && state.status === 'loaded'
  return (
    <Avatar
      {...rest}
      src={src ?? undefined}
      imgProps={{
        ...imgProps,
        onLoad: (event) => {
          if (src) setState({ src, status: 'loaded' })
          imgProps?.onLoad?.(event)
        },
        onError: (event) => {
          if (src) setState({ src, status: 'error' })
          imgProps?.onError?.(event)
        },
      }}
      data-logo-loaded={loaded ? 'true' : 'false'}
      sx={[
        avatarSx(size, fontSize, { hasImage: loaded, kind }),
        ...(loaded ? [] : [...(Array.isArray(fallbackSx) ? fallbackSx : fallbackSx ? [fallbackSx] : [])]),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Avatar>
  )
}
