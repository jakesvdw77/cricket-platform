import { Box, Typography } from '@mui/material'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import type { ImportNote } from '../../../../api/resultImportApi'

// docs/specs/104-match-results-import-adaptors.md: the import's notes that are not about a name (a skipped duplicate row,
// dropped super-over rows, an award that was not placed, ...), as a short list: warnings first, each with an icon and its
// words (never colour alone). The server's messages carry no player names. Nothing when there are none.
export function nonNameNotes(notes: ImportNote[]): ImportNote[] {
  const others = notes.filter((note) => !note.fileText)
  return [...others.filter((note) => note.severity === 'WARNING'), ...others.filter((note) => note.severity !== 'WARNING')]
}

export function ImportNotesList({ notes }: { notes: ImportNote[] }) {
  const items = nonNameNotes(notes)
  if (items.length === 0) return null
  return (
    <Box component="ul" data-testid="import-notes" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
      {items.map((note, index) => {
        const warning = note.severity === 'WARNING'
        return (
          <Box component="li" key={`${note.code}:${index}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
            {warning ? (
              <ReportProblemOutlinedIcon aria-label="Warning" sx={{ fontSize: 18, mt: '2px', color: 'warning.main', flex: 'none' }} />
            ) : (
              <InfoOutlinedIcon aria-label="Note" sx={{ fontSize: 18, mt: '2px', color: 'text.secondary', flex: 'none' }} />
            )}
            <Typography variant="body2" color={warning ? 'text.primary' : 'text.secondary'} sx={{ overflowWrap: 'anywhere' }}>
              {note.message}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
