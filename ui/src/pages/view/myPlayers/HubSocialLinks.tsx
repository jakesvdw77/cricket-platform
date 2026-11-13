import type { ReactNode } from 'react'
import { Box, IconButton, Tooltip } from '@mui/material'
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

// Links out of the Hub, shared by the league page and the Club info page (docs/specs/148, extracted from HubLeagueTabs).
export function LinkButton({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Button component="a" href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="compact" startIcon={icon} sx={[hubOutlineButton, { minHeight: 44 }] as never}>
      {children}
    </Button>
  )
}

export const SOCIAL_HOSTS: [RegExp, string, ReactNode][] = [
  [/(^|\.)(facebook|fb)\.com$/, 'Facebook', <FacebookIcon key="f" />],
  [/(^|\.)instagram\.com$/, 'Instagram', <InstagramIcon key="i" />],
  [/(^|\.)(x|twitter)\.com$/, 'X', <XIcon key="x" />],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', <YouTubeIcon key="y" />],
  [/(^|\.)linkedin\.com$/, 'LinkedIn', <LinkedInIcon key="l" />],
]

// The network a link is for is the stored `platform` first (the club picked it, and its URL may be a short link such as fb.me or a
// vanity host), then the URL's host. Owner, 2026-11-13: every icon showed as a globe because only the host was read.
const PLATFORM_ICONS: Record<string, { name: string; icon: ReactNode }> = {
  facebook: { name: 'Facebook', icon: <FacebookIcon /> },
  instagram: { name: 'Instagram', icon: <InstagramIcon /> },
  x: { name: 'X', icon: <XIcon /> },
  twitter: { name: 'X', icon: <XIcon /> },
  youtube: { name: 'YouTube', icon: <YouTubeIcon /> },
  linkedin: { name: 'LinkedIn', icon: <LinkedInIcon /> },
  whatsapp: { name: 'WhatsApp', icon: <WhatsAppIcon /> },
  pinterest: { name: 'Pinterest', icon: <PinterestIcon /> },
}

export function socialFor(url: string, fallback: string): { name: string; icon: ReactNode } {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    host = ''
  }
  const match = SOCIAL_HOSTS.find(([pattern]) => pattern.test(host))
  return match ? { name: match[1], icon: match[2] } : { name: fallback, icon: <LanguageIcon /> }
}

export interface HubLink {
  platform: string
  url: string
}

// The name a link is shown under: "Website" for the website, else the known network or the capitalised platform text.
export function describeLink(link: HubLink): { name: string; icon: ReactNode } {
  if (link.platform === 'Website' || link.platform.toLowerCase() === 'website') return { name: 'Website', icon: <LanguageIcon /> }
  const byPlatform = PLATFORM_ICONS[link.platform.trim().toLowerCase()]
  return byPlatform ?? socialFor(link.url, link.platform.charAt(0).toUpperCase() + link.platform.slice(1))
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
          <Tooltip key={`${link.platform}-${link.url}`} title={name}>
            <IconButton component="a" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={label} sx={hubFramedIconSx}>
              {icon}
            </IconButton>
          </Tooltip>
        )
      })}
    </Box>
  )
}
