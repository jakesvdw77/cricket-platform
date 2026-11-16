import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import type { SheetRow } from '../../utils/teamSheet'
import { BLANK_LINES, hourStyle, leaderNames, preMarkOf, preMarks, sheetPages } from '../../utils/teamSheet'
import type { PreMarkOption } from '../../utils/teamSheet'
import type { TeamSheetSpec } from '../../utils/share/printableTeamSheetPdf'

const GREEN = '#14452f'
const INK = '#161a17'
const LINE = '#6d786f'
const BOX = { display: 'inline-block', width: 12, height: 12, border: `1.5px solid ${INK}`, borderRadius: '2px', verticalAlign: 'middle' } as const

export interface TeamSheetPosterPreviewProps {
  spec: TeamSheetSpec
  preMark: PreMarkOption
  extraLines: boolean
  batBowl: boolean
  playingBox?: boolean
  comment: boolean
  pageCount: number
}

// A logo scaled to fit; a slot with no image, or one that fails to load, shows its label (or stays empty) so the grid never collapses.
function Logo({ url, label, height = 56 }: { url: string | null | undefined; label?: string; height?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (url && failed !== url) {
    return <Box component="img" src={url} alt="" onError={() => setFailed(url)} sx={{ maxWidth: '100%', maxHeight: height, objectFit: 'contain', display: 'block', mx: 'auto' }} />
  }
  return label ? <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: GREEN, textAlign: 'center', lineHeight: 1.2 }}>{label}</Typography> : <Box />
}

function PlayerRow({ row, preMark, zebra, batBowl, comment, side, playing }: { row: SheetRow; preMark: PreMarkOption; zebra: boolean; batBowl: boolean; comment: boolean; side: boolean; playing: boolean }) {
  const marks = preMarks(row, preMark)
  const cell = { border: `1px solid ${LINE}`, py: 0.4, px: 0.75, fontSize: '0.78rem', bgcolor: zebra ? '#eef2ee' : 'transparent' } as const
  return (
    <Box component="tr" data-testid="team-sheet-row">
      {playing && (
        <Box component="td" sx={{ ...cell, textAlign: 'center' }}>
          <Box component="span" sx={BOX} />
        </Box>
      )}
      <Box component="td" sx={{ ...cell, fontStyle: row.kind === 'player' && row.player.twelfth ? 'italic' : 'normal' }}>
        {row.kind === 'player' ? (
          <>
            {row.player.firstName} <b>{row.player.lastName.toUpperCase()}</b>
          </>
        ) : null}
      </Box>
      <Box component="td" sx={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{row.kind === 'player' && row.player.shirt !== null ? row.player.shirt : ''}</Box>
      <Box component="td" sx={{ ...cell, textAlign: 'center', fontWeight: 700, color: GREEN, fontSize: '0.7rem' }}>{side && row.kind === 'player' ? (row.player.twelfth ? '12th' : [row.player.isCaptain ? 'C' : '', row.player.isKeeper ? 'W/K' : ''].filter(Boolean).join(' ')) : marks.keeper ? 'W/K' : ''}</Box>
      {batBowl && <Box component="td" sx={cell} />}
      {batBowl && <Box component="td" sx={cell} />}
      {comment && <Box component="td" sx={cell} />}
    </Box>
  )
}

// docs/specs/153 addendum: a paper-style view of the first page of the Match Poster, close to the PDF the Download button makes.
export function TeamSheetPosterPreview({ spec, preMark, extraLines, batBowl, playingBox = true, comment, pageCount }: TeamSheetPosterPreviewProps) {
  const rows = sheetPages(spec.players, extraLines && !spec.selectedSide ? BLANK_LINES : 0)[0] ?? []
  const poster = spec.poster
  const blank = !spec.match.opposition
  const head = { bgcolor: GREEN, color: '#fff', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', py: 0.5, px: 0.75, border: '1px solid #fff' } as const
  const title = poster?.leagueTitle ?? spec.match.league
  const side = Boolean(spec.selectedSide)
  const playing = !side && playingBox
  const captain = preMarkOf(preMark).captain || side ? leaderNames(spec.players).captain : null
  const banner = side ? (spec.players.some((player) => player.twelfth) ? 'PLAYING XII' : 'PLAYING XI') : 'TEAM SHEET'
  return (
    <Box data-testid="team-sheet-poster" sx={{ position: 'relative', bgcolor: '#fff', color: INK, border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: 2, width: '100%', maxWidth: 794, mx: 'auto', overflow: 'hidden', pl: 5, pr: 2, pt: 1.5 }}>
      <Box sx={{ position: 'absolute', left: 0, top: '22%', bottom: '16%', width: 28, background: `linear-gradient(180deg, ${GREEN}, #1f6a49)`, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#fff', fontWeight: 700, letterSpacing: '0.2em', fontSize: '1.05rem', whiteSpace: 'nowrap' }}>{banner}</Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px', alignItems: 'center', gap: 1 }}>
        <Logo url={poster?.affiliationLogoUrl} label={poster?.affiliationName ?? undefined} />
        <Box sx={{ textAlign: 'center' }}>
          {spec.leagueLogoUrl && <Logo url={spec.leagueLogoUrl} height={48} />}
          {title && <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: GREEN, textTransform: 'uppercase', lineHeight: 1.15 }}>{title}</Typography>}
          {poster?.dateRange && <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{poster.dateRange}</Typography>}
        </Box>
        <Logo url={poster?.leagueAffiliationLogoUrl} label={poster?.leagueAffiliationName ?? undefined} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 56px 1fr', alignItems: 'start', gap: 1, mt: 1 }}>
        <Box>
          <Box sx={{ height: 54, display: 'grid', placeItems: 'center' }}>
            <Logo url={spec.teamLogoUrl} height={46} />
          </Box>
          <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', mt: 1 }}>{spec.teamName}</Typography>
        </Box>
        <Typography sx={{ textAlign: 'center', fontWeight: 700, fontStyle: 'italic', fontSize: '1.4rem', color: '#1f6a49', pt: 2 }}>vs</Typography>
        <Box>
          <Box sx={{ height: 54, display: 'grid', placeItems: 'center' }}>
            <Logo url={spec.match.oppositionLogoUrl} height={46} />
          </Box>
          <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', mt: 1, minHeight: 20, borderBottom: blank ? `1px solid ${INK}` : 'none' }}>{spec.match.opposition ?? ''}</Typography>
        </Box>
      </Box>
      {blank ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mt: 1.5, fontWeight: 700, fontStyle: 'italic', fontSize: '0.8rem' }}>
          DATE: <Box sx={{ flex: 1, borderBottom: `1px solid ${INK}`, height: 18 }} /> TIME: <Box sx={{ flex: '0 0 50px', borderBottom: `1px solid ${INK}`, height: 18 }} /> VENUE:{' '}
          <Box sx={{ flex: 1, borderBottom: `1px solid ${INK}`, height: 18 }} />
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Typography sx={{ fontWeight: 700, fontStyle: 'italic', fontSize: '1rem' }}>
            DATE: {spec.match.date}
            {spec.match.time ? ` - ${hourStyle(spec.match.time)}` : ''}
          </Typography>
          {spec.match.stage && <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: GREEN, textTransform: 'uppercase' }}>{spec.match.stage}</Typography>}
          {spec.match.venue && <Typography sx={{ fontSize: '0.72rem', color: '#5a625c' }}>VENUE: {spec.match.venue}</Typography>}
        </Box>
      )}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mt: 1 }}>
        <Box component="thead">
          <Box component="tr">
            {playing && <Box component="th" rowSpan={batBowl ? 2 : 1} sx={head}>Playing</Box>}
            <Box component="th" rowSpan={batBowl ? 2 : 1} sx={{ ...head, textAlign: 'left' }}>Player</Box>
            <Box component="th" rowSpan={batBowl ? 2 : 1} sx={head}>Shirt</Box>
            <Box component="th" rowSpan={batBowl ? 2 : 1} sx={head}>{side ? 'C / W/K' : 'W/K'}</Box>
            {batBowl && <Box component="th" colSpan={2} sx={head}>Players</Box>}
            {comment && <Box component="th" rowSpan={batBowl ? 2 : 1} sx={head}>Comment</Box>}
          </Box>
          {batBowl && (
            <Box component="tr">
              <Box component="th" sx={{ ...head, fontSize: '0.55rem' }}>Bat Pos</Box>
              <Box component="th" sx={{ ...head, fontSize: '0.55rem' }}>Bowl</Box>
            </Box>
          )}
        </Box>
        <Box component="tbody">
          {rows.map((row, index) => (
            <PlayerRow key={row.kind === 'player' ? row.player.key : row.key} row={row} preMark={preMark} zebra={index % 2 === 1} batBowl={batBowl} comment={comment} side={side} playing={playing} />
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mt: 4, mb: 2, fontWeight: 700, fontStyle: 'italic', fontSize: '0.85rem' }}>
        CAPTAIN: <Box sx={{ flex: 1, borderBottom: `1px solid ${INK}`, minHeight: 18, fontStyle: 'normal', pl: 0.5 }}>{captain ?? ''}</Box> SIGN: <Box sx={{ flex: 1, borderBottom: `1px solid ${INK}`, height: 18 }} />
      </Box>
      <Box sx={{ mx: -2, ml: -5, height: 62, background: `linear-gradient(180deg, #fff, ${GREEN})`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', px: 2, pb: 1, gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {(poster?.sponsorLogoUrls ?? []).slice(0, 4).map((url) => (
            <Box key={url} sx={{ bgcolor: '#fff', borderRadius: 1, width: 64, height: 32, display: 'grid', placeItems: 'center' }}>
              <Logo url={url} height={26} />
            </Box>
          ))}
        </Box>
        {(poster?.hostName || poster?.hostLogoUrl) && (
          <Box sx={{ textAlign: 'right', color: '#fff' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em' }}>HOST:</Typography>
            {poster?.hostName && <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{poster.hostName}</Typography>}
            {poster?.hostLogoUrl && (
              <Box sx={{ bgcolor: '#fff', borderRadius: 1, width: 56, height: 30, display: 'grid', placeItems: 'center', ml: 'auto', mt: 0.25 }}>
                <Logo url={poster.hostLogoUrl} height={24} />
              </Box>
            )}
          </Box>
        )}
      </Box>
      {pageCount > 1 && <Typography sx={{ fontSize: '0.68rem', color: '#5a625c', textAlign: 'center', py: 0.5 }}>{`This sheet runs to ${pageCount} pages.`}</Typography>}
    </Box>
  )
}
