import { IconButton, Stack } from '@mui/material'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import YouTubeIcon from '@mui/icons-material/YouTube'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PinterestIcon from '@mui/icons-material/Pinterest'
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

export interface SocialLink {
  // Free text on the wire (matches the backend's SocialLink embeddable) — a recognized
  // SocialPlatform value renders with its dedicated icon/label below, anything else (including a
  // club-typed custom label) falls back to a generic link icon and its own raw string as label.
  platform: SocialPlatform | (string & {})
  url: string
}

export interface SocialLinksRowProps {
  links: SocialLink[]
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
}

const LABELS: Partial<Record<SocialPlatform, string>> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  pinterest: 'Pinterest',
}

export function SocialLinksRow({ links }: SocialLinksRowProps) {
  return (
    <Stack direction="row" spacing={0.5}>
      {links.map(({ platform, url }) => {
        const Icon = ICONS[platform as SocialPlatform] ?? LinkIcon
        const label = LABELS[platform as SocialPlatform] ?? platform
        return (
          <IconButton
            key={platform}
            component="a"
            href={url}
            target="_blank"
            rel="noopener"
            aria-label={label}
            color="inherit"
          >
            <Icon fontSize="small" />
          </IconButton>
        )
      })}
    </Stack>
  )
}
