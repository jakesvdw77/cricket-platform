import { IconButton, Stack } from '@mui/material'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import YouTubeIcon from '@mui/icons-material/YouTube'

export type SocialPlatform = 'facebook' | 'instagram' | 'x' | 'linkedin' | 'youtube'

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export interface SocialLinksRowProps {
  links: SocialLink[]
}

const ICONS: Record<SocialPlatform, typeof FacebookIcon> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  x: XIcon,
  linkedin: LinkedInIcon,
  youtube: YouTubeIcon,
}

const LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

export function SocialLinksRow({ links }: SocialLinksRowProps) {
  return (
    <Stack direction="row" spacing={0.5}>
      {links.map(({ platform, url }) => {
        const Icon = ICONS[platform]
        return (
          <IconButton
            key={platform}
            component="a"
            href={url}
            target="_blank"
            rel="noopener"
            aria-label={LABELS[platform]}
            color="inherit"
          >
            <Icon fontSize="small" />
          </IconButton>
        )
      })}
    </Stack>
  )
}
