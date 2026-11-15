import { Box, Typography } from '@mui/material'
import { BLANK_LINES, preMarks, sheetPages } from '../../utils/teamSheet'
import type { SheetRow } from '../../utils/teamSheet'
import type { TeamSheetSpec } from '../../utils/share/printableTeamSheetPdf'

// docs/specs/153: a paper-style preview of the FIRST page of a sheet, built from the same rows the PDF draws, so what is read here is
// what prints. (No page image is drawn, so the preview works on every browser and phone.)
const BOX = { display: 'inline-block', width: 12, height: 12, border: '1.5px solid #161a17', borderRadius: '2px', verticalAlign: 'middle' } as const

function Row({ row, preMark, zebra }: { row: SheetRow; preMark: boolean; zebra: boolean }) {
  const marks = preMarks(row, preMark)
  const cell = { py: 0.5, px: 0.75, borderBottom: '1px solid #9aa59d', fontSize: '0.8125rem', bgcolor: zebra ? '#eef2ee' : 'transparent' } as const
  return (
    <Box component="tr" data-testid="team-sheet-row">
      <Box component="td" sx={{ ...cell, textAlign: 'center' }}>
        <Box component="span" sx={BOX} />
      </Box>
      <Box component="td" sx={{ ...cell, fontWeight: 700 }}>{row.kind === 'player' && row.player.shirt !== null ? row.player.shirt : ''}</Box>
      <Box component="td" sx={cell}>{row.kind === 'player' ? row.player.firstName : ''}</Box>
      <Box component="td" sx={cell}>{row.kind === 'player' ? row.player.lastName : ''}</Box>
      <Box component="td" sx={{ ...cell, textAlign: 'center' }}>
        <Box component="span" data-testid={marks.captain ? 'mark-captain' : undefined} sx={{ ...BOX, bgcolor: marks.captain ? '#161a17' : 'transparent' }} />
      </Box>
      <Box component="td" sx={{ ...cell, textAlign: 'center' }}>
        <Box component="span" data-testid={marks.keeper ? 'mark-keeper' : undefined} sx={{ ...BOX, bgcolor: marks.keeper ? '#161a17' : 'transparent' }} />
      </Box>
    </Box>
  )
}

export function TeamSheetPaperPreview({ spec, preMark, extraLines = true, pageCount }: { spec: TeamSheetSpec; preMark: boolean; extraLines?: boolean; pageCount: number }) {
  const rows = sheetPages(spec.players, extraLines ? BLANK_LINES : 0)[0] ?? []
  const cells: [string, string | null][] = [
    ['League', spec.match.league],
    ['Opposition', spec.match.opposition],
    ['Date', spec.match.date],
    ['Start time', spec.match.time],
    ['Venue', spec.match.venue],
    ['Toss won by', null],
    ['Elected to', null],
    ['Overs', spec.match.overs],
  ]
  const head = { bgcolor: '#14452f', color: '#fff', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', py: 0.5, px: 0.75, textAlign: 'left' } as const
  return (
    <Box data-testid="team-sheet-paper" sx={{ bgcolor: '#fff', color: '#161a17', border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: 2, p: { xs: 1.5, sm: 2.5 }, width: '100%', maxWidth: 794, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', borderBottom: '3px solid #14452f', pb: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#5a625c' }}>TEAM SHEET</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '1.4rem', color: '#14452f', textTransform: 'uppercase', lineHeight: 1.15 }}>{spec.teamName}</Typography>
        {spec.subtitle && <Typography sx={{ fontSize: '0.8125rem' }}>{spec.subtitle}</Typography>}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px 12px', my: 1.5 }}>
        {cells.map(([label, value]) => (
          <Box key={label} sx={{ borderBottom: '1px solid #161a17', minHeight: 34 }}>
            <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a625c' }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>{value ?? ''}</Typography>
          </Box>
        ))}
      </Box>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ ...head, textAlign: 'center' }}>Playing</Box>
            <Box component="th" sx={head}>Shirt</Box>
            <Box component="th" sx={head}>First name</Box>
            <Box component="th" sx={head}>Surname</Box>
            <Box component="th" sx={{ ...head, textAlign: 'center' }}>Capt</Box>
            <Box component="th" sx={{ ...head, textAlign: 'center' }}>Keeper</Box>
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((row, index) => (
            <Row key={row.kind === 'player' ? row.player.key : row.key} row={row} preMark={preMark} zebra={index % 2 === 1} />
          ))}
        </Box>
      </Box>
      <Typography sx={{ fontSize: '0.7rem', color: '#5a625c', mt: 1 }}>
        Tick 11 under Playing. The two empty lines are for a late or guest player.{pageCount > 1 ? ` This sheet runs to ${pageCount} pages.` : ''}
      </Typography>
    </Box>
  )
}
