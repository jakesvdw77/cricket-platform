import { Box, Link } from '@mui/material'
import type { MyClubInfo } from '../../../api/meClubInfoApi'
import { Fact, FactsCard } from './HubFacts'
import { describeLink, HubSocialIconRow } from './HubSocialLinks'
import { HUB } from './hubStyle'
import { isHttps } from './leagueFormat'

// docs/specs/148 (Links): framed icon buttons for the website and each social page, then the same links as labelled text rows
// (platform name, host) so a screen reader and a keyboard user have a list. Always a new tab with rel="noopener noreferrer".
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function HubClubLinks({ info }: { info: MyClubInfo }) {
  const links = [...(info.links?.website ? [{ platform: 'Website', url: info.links.website }] : []), ...(info.links?.social ?? [])].filter((link) => isHttps(link.url))
  if (links.length === 0) return null
  return (
    <Box data-testid="hub-club-links" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <HubSocialIconRow links={links} ownerLabel={info.clubName} justify="flex-start" />
      <FactsCard title="Club links" single>
        <Box role="list" sx={{ display: 'contents' }}>
          {links.map((link, index) => (
            <Box key={`${link.platform}-${link.url}`} role="listitem" sx={{ minWidth: 0 }}>
              <Fact
                single
                last={index === links.length - 1}
                label={describeLink(link).name}
                value={<Link href={link.url} target="_blank" rel="noopener noreferrer" sx={{ color: HUB.cream, textDecorationColor: HUB.line }}>{hostOf(link.url)}</Link>}
              />
            </Box>
          ))}
        </Box>
      </FactsCard>
    </Box>
  )
}
