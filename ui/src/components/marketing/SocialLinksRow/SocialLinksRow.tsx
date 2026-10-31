import { Box, IconButton, Link as MuiLink, Stack, Tooltip } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { readablePrimary } from '../../../theme'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import YouTubeIcon from '@mui/icons-material/YouTube'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PinterestIcon from '@mui/icons-material/Pinterest'
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined'
import LinkIcon from '@mui/icons-material/Link'

// The full "popular platform" list docs/specs/022-club-social-media.md names. Not every value
// here has a dedicated @mui/icons-material icon (tiktok/threads/snapchat don't) — this union is
// a display/UX convenience for platforms with a recognized icon, not a data-model constraint;
// SocialLink.platform itself stays a free-text string (see SocialLinksFields) so an unrecognized
// or fully custom label is always valid and falls back to a generic icon below.
export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'x'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'whatsapp'
  | 'threads'
  | 'pinterest'
  | 'snapchat'
  // docs/specs/071-league-card-redesign.md: a website rendered as the first icon of a card's row.
  | 'website'

export interface SocialLink {
  // Free text on the wire (matches the backend's SocialLink embeddable) — a recognized
  // SocialPlatform value renders with its dedicated icon/label below, anything else (including a
  // club-typed custom label) falls back to a generic link icon and its own raw string as label.
  platform: SocialPlatform | (string & {})
  url: string
}

export interface SocialLinksRowProps {
  links: SocialLink[]
  size?: 'small' | 'medium'
  // 'round' (docs/standards/design-system.md, League page): a 32 px white circle with a 1 px green edge, a tooltip with the network
  // name and a 44 px touch area below md. Default 'plain' is unchanged.
  // 'labelled': an inline contact item per link, a 16 px icon then the network name as a text link (the League page contacts line).
  variant?: 'plain' | 'round' | 'labelled'
}

// Partial by design — only the platforms with a real @mui/icons-material icon get an entry here.
// tiktok/threads/snapchat (no official icon available) and any custom platform string fall
// through the `?? LinkIcon` fallback below.
const ICONS: Partial<Record<SocialPlatform, typeof FacebookIcon>> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  x: XIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
  whatsapp: WhatsAppIcon,
  pinterest: PinterestIcon,
  website: LanguageOutlinedIcon,
}

const LABELS: Partial<Record<SocialPlatform, string>> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  pinterest: 'Pinterest',
  website: 'Website',
}

const roundSx = {
  position: 'relative',
  width: { xs: 44, md: 32 },
  height: { xs: 44, md: 32 },
  p: 0,
  border: 1,
  borderColor: (theme) => readablePrimary(theme, 'edge'),
  color: (theme) => readablePrimary(theme, 'text'),
  bgcolor: 'background.paper',
  '& svg': { fontSize: 18 },
  '&:hover': {
    bgcolor: 'background.paper',
    backgroundImage: (theme) => `linear-gradient(${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.08)})`,
  },
  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
} as const

export function SocialLinksRow({ links, size = 'medium', variant = 'plain' }: SocialLinksRowProps) {
  const round = variant === 'round'
  if (variant === 'labelled') {
    return (
      <Box data-testid="social-links-labelled" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2.5, rowGap: 0.75 }}>
        {links.map(({ platform, url }) => {
          const Icon = ICONS[platform as SocialPlatform] ?? LinkIcon
          const label = LABELS[platform as SocialPlatform] ?? platform
          return (
            <Box key={platform} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <MuiLink
                href={url}
                target="_blank"
                rel="noopener"
                underline="hover"
                aria-label={label}
                sx={{ fontSize: 13, color: 'text.secondary', overflowWrap: 'anywhere', '&.Mui-focusVisible, &:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}
              >
                {label}
              </MuiLink>
            </Box>
          )
        })}
      </Box>
    )
  }
  return (
    <Stack direction="row" spacing={round ? 1 : 0.5} alignItems="center">
      {links.map(({ platform, url }) => {
        const Icon = ICONS[platform as SocialPlatform] ?? LinkIcon
        const label = LABELS[platform as SocialPlatform] ?? platform
        const button = (
          <IconButton
            key={round ? undefined : platform}
            component="a"
            href={url}
            target="_blank"
            rel="noopener"
            aria-label={label}
            color="inherit"
            size={size}
            sx={round ? roundSx : undefined}
          >
            <Icon fontSize="small" />
          </IconButton>
        )
        return round ? (
          <Tooltip key={platform} title={label}>
            {button}
          </Tooltip>
        ) : (
          button
        )
      })}
    </Stack>
  )
}
