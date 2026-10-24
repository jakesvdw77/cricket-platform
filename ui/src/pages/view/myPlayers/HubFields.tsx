import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, InputAdornment, Skeleton, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { Button } from '../../../components/Button'
import { useMyPlayerFields } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB, darkFieldSx, hubPageHeading } from './hubStyle'
import { HubFieldCard } from './HubFieldCard'
import { matchesSearch } from './fieldFormat'

// docs/specs/121 (Field Directory, Decisions 6, 19, 21): the read-only list of the selected player's club fields. Search is
// client side; the server caps the list at 200. No Edit or Add. The footer owns Back.
const CAP = 200
const empty = { border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, color: HUB.muted } as const

export function HubFields({ playerKey }: { playerKey?: string }) {
  const fields = useMyPlayerFields(playerKey)
  const [query, setQuery] = useState('')
  // A different player may belong to another club: start a fresh search.
  useEffect(() => setQuery(''), [playerKey])
  const list = fields.data
  const shown = useMemo(() => (list ?? []).filter((field) => matchesSearch(field, query)), [list, query])

  let body
  if (fields.isLoading) {
    body = (
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} variant="rounded" height={150} sx={{ bgcolor: creamAlpha(0.12) }} />)}
      </Box>
    )
  } else if (fields.isError) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => fields.refetch()}>Retry</Button>}>
        We could not load the fields. Please try again.
      </Alert>
    )
  } else if ((list ?? []).length === 0) {
    body = <Box sx={empty}>No fields yet. Fields appear here once your club adds them or links them to a match.</Box>
  } else if (shown.length === 0) {
    body = <Box sx={empty}>No fields match your search.</Box>
  } else {
    body = (
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {shown.map((field) => <HubFieldCard key={field.id} field={field} />)}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Typography component="h2" sx={hubPageHeading}>
        Field Directory
      </Typography>
      <TextField
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Escape clears the text first; the page-level Escape (footer Back) only runs on an empty box.
          if (event.key === 'Escape' && query) {
            event.preventDefault()
            setQuery('')
          }
        }}
        placeholder="Search fields"
        inputProps={{ 'aria-label': 'Search fields', 'data-hub-escape': true }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: HUB.muted }} /></InputAdornment> }}
        sx={{ ...darkFieldSx, '& .MuiInputBase-root': { ...darkFieldSx['& .MuiInputBase-root'], minHeight: 44 } }}
        fullWidth
      />
      {body}
      <Typography sx={{ fontSize: 14, color: HUB.muted }}>Away fields appear once your club links a field to a match.</Typography>
      {list && list.length === CAP && <Typography sx={{ fontSize: 14, color: HUB.muted }}>Showing the first 200 fields.</Typography>}
    </Box>
  )
}
