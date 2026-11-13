import type { ReactNode } from 'react'
import { Box, IconButton, Tooltip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import LanguageIcon from '@mui/icons-material/Language'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import XIcon from '@mui/icons-material/X'
import YouTubeIcon from '@mui/icons-material/YouTube'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PinterestIcon from '@mui/icons-material/Pinterest'
import { Button } from '../../../components/Button'
import { hubFramedIconSx, hubOutlineButton } from './hubStyle'
import { isHttps } from './leagueFormat'

// The one framed icon link: external links open a new tab with rel="noopener noreferrer", tel:/mailto: and downloads do not.
export function HubIconLink({ href, label, tooltip, icon, external, download, sx }: { href: string; label: string; tooltip?: string; icon: ReactNode; external?: boolean; download?: string; sx?: SxProps<Theme> }) {
  return (
    <Tooltip title={tooltip ?? label}>
      <IconButton
        component="a"
        href={href}
        aria-label={label}
        sx={[hubFramedIconSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])] as never}
        {...(download !== undefined ? { download } : {})}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {icon}
      </IconButton>
    </Tooltip>
  )
}

// Links out of the Hub, shared by the league page and the Club info page (docs/specs/148, extracted from HubLeagueTabs).
export function LinkButton({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Button component="a" href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="compact" startIcon={icon} sx={[hubOutlineButton, { minHeight: 44 }] as never}>
      {children}
    </Button>
  )
}

// One table of networks: the stored `platform` keys (the club picked it, and its URL may be a short link such as fb.me or a vanity
// host) and a host pattern per network. Owner, 2026-11-13: every icon showed as a globe because only the host was read.
interface Network {
  name: string
  keys: string[]
  host?: RegExp
  icon: ReactNode
}
const NETWORKS: Network[] = [
  { name: 'Facebook', keys: ['facebook'], host: /(^|\.)(facebook|fb)\.com$/, icon: <FacebookIcon /> },
  { name: 'Instagram', keys: ['instagram'], host: /(^|\.)instagram\.com$/, icon: <InstagramIcon /> },
  { name: 'X', keys: ['x', 'twitter'], host: /(^|\.)(x|twitter)\.com$/, icon: <XIcon /> },
  { name: 'YouTube', keys: ['youtube'], host: /(^|\.)(youtube\.com|youtu\.be)$/, icon: <YouTubeIcon /> },
  { name: 'LinkedIn', keys: ['linkedin'], host: /(^|\.)linkedin\.com$/, icon: <LinkedInIcon /> },
  { name: 'WhatsApp', keys: ['whatsapp'], icon: <WhatsAppIcon /> },
  { name: 'Pinterest', keys: ['pinterest'], icon: <PinterestIcon /> },
]

export function socialFor(url: string, fallback: string): { name: string; icon: ReactNode } {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    host = ''
  }
  const match = NETWORKS.find((network) => network.host?.test(host))
  return match ? { name: match.name, icon: match.icon } : { name: fallback, icon: <LanguageIcon /> }
}

export interface HubLink {
  platform: string
  url: string
}

// The name a link is shown under: "Website" for the website, else the known network or the capitalised platform text.
export function describeLink(link: HubLink): { name: string; icon: ReactNode } {
  if (link.platform === 'Website' || link.platform.toLowerCase() === 'website') return { name: 'Website', icon: <LanguageIcon /> }
  const key = link.platform.trim().toLowerCase()
  const byPlatform = NETWORKS.find((network) => network.keys.includes(key))
  return byPlatform ? { name: byPlatform.name, icon: byPlatform.icon } : socialFor(link.url, link.platform.charAt(0).toUpperCase() + link.platform.slice(1))
}

// A row of framed icon buttons (https links only). Without `ownerLabel` the accessible name is "Facebook (opens in a new tab)";
// with one it is "Riverside CC on Facebook" (the website reads "Riverside CC website").
export function HubSocialIconRow({ links, ownerLabel, justify = 'flex-end' }: { links: HubLink[]; ownerLabel?: string; justify?: 'flex-start' | 'flex-end' }) {
  const shown = links.filter((link) => isHttps(link.url))
  if (shown.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: justify, gap: 1 }}>
      {shown.map((link) => {
        const { name, icon } = describeLink(link)
        const label = ownerLabel ? (name === 'Website' ? `${ownerLabel} website` : `${ownerLabel} on ${name}`) : `${name} (opens in a new tab)`
        return (
          <HubIconLink key={`${link.platform}-${link.url}`} href={link.url} label={label} tooltip={name} icon={icon} external />
        )
      })}
    </Box>
  )
}
