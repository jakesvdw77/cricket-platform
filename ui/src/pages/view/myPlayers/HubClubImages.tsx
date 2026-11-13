import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined'
import type { ReactNode } from 'react'
import { LogoAvatar } from '../../../components/LogoAvatar'
import { initialsFromName } from '../../../utils/initials'
import type { MyClubLogos } from '../../../api/meClubInfoApi'
import { blackAlpha } from '../../../brandTokens'
import { HUB, hubFramedIconSx } from './hubStyle'
import { logoFileName } from './clubInfo/clubInfoFormat'

// docs/specs/148 (Logos on About, Decision 8): the banner as a wide band and the logo as the large avatar beside the club name. The
// Download link is offered per file only when the club allows it. It is the one `download` attribute in the Club info feature.
function DownloadLink({ href, name, label, offset = 8 }: { href: string; name: string; label: string; offset?: number }) {
  return (
    <Tooltip title={label}>
      <IconButton component="a" href={href} download={name} aria-label={label} sx={{ ...hubFramedIconSx, position: 'absolute', right: offset, bottom: offset }}>
        <DownloadIcon />
      </IconButton>
    </Tooltip>
  )
}

export function HubClubBanner({ clubName, url, downloadable }: { clubName: string; url: string; downloadable: boolean }) {
  return (
    <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 5', borderRadius: '8px', overflow: 'hidden', border: 1, borderColor: HUB.lineSoft, bgcolor: blackAlpha(0.3) }}>
      <Box component="img" src={url} alt={`${clubName} banner`} sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
      {downloadable && <DownloadLink href={url} name={logoFileName(clubName, 'banner', url)} label="Download banner" />}
    </Box>
  )
}

export function HubClubLogo({ clubName, url, downloadable }: { clubName: string; url: string | null; downloadable: boolean }) {
  return (
    <Box sx={{ position: 'relative', flex: 'none' }}>
      <LogoAvatar
        src={url}
        size={88}
        variant="circular"
        fontSize="34px"
        imgProps={{ alt: `${clubName} logo` }}
        sx={{ border: `1px solid ${HUB.line}`, '& img': { objectFit: 'contain' } }}
      >
        {initialsFromName(clubName)}
      </LogoAvatar>
      {downloadable && url && (
        <DownloadLink href={url} name={logoFileName(clubName, 'logo', url)} label="Download logo" offset={-10} />
      )}
    </Box>
  )
}

// The top of About: the banner (when there is one), then the logo beside the club name.
// `trailing` sits at the right end of the logo and name row (owner, 2026-11-13: the social icons are right aligned in the header row).
export function HubClubImages({ clubName, logos, children, trailing }: { clubName: string; logos: MyClubLogos | null; children?: ReactNode; trailing?: ReactNode }) {
  const downloadable = Boolean(logos?.downloadable)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      {logos?.bannerUrl && <HubClubBanner clubName={clubName} url={logos.bannerUrl} downloadable={downloadable} />}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
        <HubClubLogo clubName={clubName} url={logos?.logoUrl ?? null} downloadable={downloadable} />
        <Box sx={{ minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 0.5 }}>
          <Typography component="h2" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 28, lineHeight: 1.1, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.sand, overflowWrap: 'anywhere' }}>
            {clubName}
          </Typography>
          {children}
        </Box>
        {trailing && <Box sx={{ ml: 'auto', flex: 'none', display: 'flex', justifyContent: 'flex-end' }}>{trailing}</Box>}
      </Box>
    </Box>
  )
}
