import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { MAX_FOOTER_SPONSORS_WITH_AFFILIATION } from '../../utils/share/teamSheetPosterPdf'
import { leaderNames } from '../../utils/teamSheet'
import type { TeamSheetSpec } from '../../utils/share/printableTeamSheetPdf'
import type { CoverOptions } from '../../utils/share/tournamentCoverPdf'

const GREEN = '#14452f'
const INK = '#161a17'
const GOLD = '#e8b53f'

export interface TeamSheetCoverPreviewProps {
  spec: TeamSheetSpec
  options: CoverOptions
}

// A logo scaled to fit; a slot with no image, or one that fails to load, shows its label (or stays empty) so the layout never collapses.
function Logo({ url, label, height }: { url: string | null | undefined; label?: string; height: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (url && failed !== url) {
    return <Box component="img" src={url} alt="" onError={() => setFailed(url)} sx={{ maxWidth: '100%', maxHeight: height, objectFit: 'contain', display: 'block', mx: 'auto' }} />
  }
  return label ? <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: GREEN, textAlign: 'center', lineHeight: 1.2 }}>{label}</Typography> : <Box />
}

function Line({ label, value, double }: { label: string; value?: string | null; double?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mt: 1.5 }}>
      <Typography sx={{ width: 78, fontWeight: 700, fontStyle: 'italic', fontSize: '0.72rem', color: GREEN, textTransform: 'uppercase' }}>{`${label}:`}</Typography>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ borderBottom: `1px solid ${INK}`, minHeight: 18, fontWeight: 700, fontSize: '0.85rem', pl: 0.5 }}>{value ?? ''}</Box>
        {double && <Box sx={{ borderBottom: `1px solid ${INK}`, height: 22 }} />}
      </Box>
    </Box>
  )
}

// docs/specs/159: a paper-style view of the Tournament Cover Page, close to the PDF the Download button makes.
export function TeamSheetCoverPreview({ spec, options }: TeamSheetCoverPreviewProps) {
  const poster = spec.poster
  const title = poster?.leagueTitle ?? spec.match.league
  const captain = options.fillCaptain ? leaderNames(spec.players).captain : null
  const affiliated = Boolean(poster?.affiliationLogoUrl || poster?.affiliationName)
  return (
    <Box data-testid="team-sheet-cover" sx={{ bgcolor: '#fff', color: INK, border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: 2, width: '100%', maxWidth: 560, mx: 'auto', aspectRatio: '210 / 297', display: 'flex', flexDirection: 'column', p: '3.3%', overflow: 'hidden' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, alignItems: 'center', px: '4%', height: '9%' }}>
        <Box sx={{ width: '60%' }}>
          <Logo url={poster?.leagueAffiliationLogoUrl} label={poster?.leagueAffiliationName ?? undefined} height={46} />
        </Box>
        <Box sx={{ width: '60%', ml: 'auto' }}>
          <Logo url={poster?.clubLogoUrl} height={46} />
        </Box>
      </Box>
      <Box sx={{ height: '19%', mt: 1, display: 'grid', placeItems: 'center' }}>
        <Logo url={spec.leagueLogoUrl} height={100} />
      </Box>
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        {title && <Typography sx={{ fontWeight: 800, fontSize: '1.45rem', lineHeight: 1.1, color: GREEN, textTransform: 'uppercase' }}>{title}</Typography>}
        {poster?.dateRange && <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mt: 0.5 }}>{poster.dateRange}</Typography>}
        <Box sx={{ width: '28%', height: 4, bgcolor: GOLD, mx: 'auto', mt: 1 }} />
      </Box>
      <Box sx={{ textAlign: 'center', mt: 1.5 }}>
        <Box sx={{ height: 80, display: 'grid', placeItems: 'center' }}>
          <Logo url={spec.teamLogoUrl} height={78} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', textTransform: 'uppercase', mt: 0.5 }}>{spec.teamName}</Typography>
        {spec.subtitle && <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1f6a49' }}>{spec.subtitle}</Typography>}
      </Box>
      <Box sx={{ px: '4%', mt: 0.5 }}>
        {options.captain && <Line label="Captain" value={captain} />}
        {options.manager && <Line label="Manager" />}
        {options.contact && <Line label="Contact" />}
        {options.notes && <Line label="Notes" double />}
      </Box>
      <Box sx={{ flex: 1 }} />
      <Box sx={{ height: 62, background: `linear-gradient(180deg, #fff, ${GREEN})`, borderBottom: `4px solid ${GOLD}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', px: 1.5, pb: 1, gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {affiliated && (
            <Box sx={{ bgcolor: '#fff', borderRadius: 1, width: 64, height: 32, display: 'grid', placeItems: 'center', px: 0.25 }}>
              <Logo url={poster?.affiliationLogoUrl} label={poster?.affiliationName ?? undefined} height={26} />
            </Box>
          )}
          {(poster?.sponsorLogoUrls ?? []).slice(0, affiliated ? MAX_FOOTER_SPONSORS_WITH_AFFILIATION : 4).map((url) => (
            <Box key={url} sx={{ bgcolor: '#fff', borderRadius: 1, width: 64, height: 32, display: 'grid', placeItems: 'center' }}>
              <Logo url={url} height={26} />
            </Box>
          ))}
        </Box>
        {(poster?.hostName || poster?.hostLogoUrl) && (
          <Box sx={{ textAlign: 'right', color: '#fff' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em' }}>HOST:</Typography>
            {poster?.hostName && <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{poster.hostName}</Typography>}
          </Box>
        )}
      </Box>
    </Box>
  )
}
