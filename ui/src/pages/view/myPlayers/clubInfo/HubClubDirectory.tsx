import { useEffect, useState } from 'react'
import { Alert, Box, IconButton, InputAdornment, Link, Skeleton, TextField, ToggleButton, Typography } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import SearchIcon from '@mui/icons-material/Search'
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import { alpha } from '@mui/material/styles'
import { isNotFound } from '../../../../utils/errorDetail'
import { Button } from '../../../../components/Button'
import { CompactToggleGroup } from '../../../../components/CompactToggleGroup'
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue'
import { useMyClubContacts } from '../../../../api/meClubInfoApi'
import type { ClubContactSort, MyClubContact, MyClubDirectory } from '../../../../api/meClubInfoApi'
import { creamAlpha } from '../../../../brandTokens'
import { HUB, darkFieldSx } from '../hubStyle'
import { ClubContactRow } from './ClubContactRow'
import { letterOf } from './clubInfoFormat'

// docs/specs/148 (Contacts): the club's phone book for parents and players. Read only and never exported: no share, print, download,
// CSV, vCard or copy-all control. The server sorts, filters and pages; nothing is sliced here.
const headingSx = { fontFamily: HUB.display, fontWeight: 600, fontSize: 20, letterSpacing: '0.1em', textTransform: 'uppercase', color: HUB.sand, m: 0, pt: 1.5 } as const
const NONE = { query: '', sort: 'name' as ClubContactSort, letter: null as string | null }

interface Group {
  heading: string
  contacts: MyClubContact[]
}

// Consecutive contacts under the same heading (the server order is kept as it came).
function groupContacts(items: MyClubContact[], sort: ClubContactSort): Group[] {
  const groups: Group[] = []
  for (const contact of items) {
    const heading = sort === 'role' ? (contact.role?.trim() || 'Other') : letterOf(contact.lastName)
    const last = groups[groups.length - 1]
    if (last && last.heading === heading) last.contacts.push(contact)
    else groups.push({ heading, contacts: [contact] })
  }
  return groups
}

function EmptyBlock({ icon, title, line, children }: { icon: React.ReactNode; title: string; line: string; children?: React.ReactNode }) {
  return (
    <Box data-testid="club-contacts-empty" sx={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 1, border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 3 }}>
      {icon}
      <Typography component="h2" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.sand }}>{title}</Typography>
      <Typography sx={{ color: HUB.muted }}>{line}</Typography>
      {children}
    </Box>
  )
}

export function HubClubDirectory({ playerKey, directory }: { playerKey?: string; directory: MyClubDirectory | null }) {
  const [text, setText] = useState(NONE.query)
  const [sort, setSort] = useState<ClubContactSort>(NONE.sort)
  const [letter, setLetter] = useState<string | null>(NONE.letter)
  const query = useDebouncedValue(text, 300)
  // A different player may belong to another club: start fresh.
  useEffect(() => {
    setText(NONE.query)
    setSort(NONE.sort)
    setLetter(NONE.letter)
  }, [playerKey])

  const contacts = useMyClubContacts(playerKey, { query, sort, letter }, directory !== null)
  const phoneShown = directory?.phoneShown ?? false
  const emailShown = directory?.emailShown ?? false
  const filtered = query.trim() !== '' || letter !== null
  const notFound = contacts.isError && isNotFound(contacts.error)
  const clearSearch = () => {
    setText('')
    setLetter(null)
  }

  let body
  if (notFound || (!filtered && !contacts.isLoading && !contacts.isError && contacts.items.length === 0 && !contacts.isFetching)) {
    body = <EmptyBlock icon={<ContactsOutlinedIcon aria-hidden sx={{ fontSize: 40, color: HUB.muted }} />} title="No Contacts Yet" line="The club has not added any contacts yet." />
  } else if (contacts.isError) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => contacts.refetch()}>Retry</Button>}>
        We could not load the contacts. Please try again.
      </Alert>
    )
  } else if (contacts.isLoading || (!contacts.data && contacts.isFetching)) {
    body = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1 }} aria-busy="true">
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} variant="rounded" height={64} sx={{ bgcolor: creamAlpha(0.12) }} />)}
      </Box>
    )
  } else if (contacts.items.length === 0) {
    body = (
      <EmptyBlock icon={<SearchOffOutlinedIcon aria-hidden sx={{ fontSize: 40, color: HUB.muted }} />} title="No Contacts Match" line="Nothing matches that search. Try a different name or role.">
        <Link component="button" type="button" underline="always" onClick={clearSearch} sx={{ color: HUB.cream, fontSize: 16, minHeight: 44 }}>Clear Search</Link>
      </EmptyBlock>
    )
  } else {
    body = (
      <>
        <Box component="ul" sx={{ m: 0, p: 0 }}>
          {groupContacts(contacts.items, sort).map((group, index) => (
            <Box component="li" key={group.heading} sx={{ listStyle: 'none' }}>
              <Typography component="h3" id={`club-contacts-group-${index}`} sx={headingSx}>{group.heading}</Typography>
              <Box component="ul" aria-labelledby={`club-contacts-group-${index}`} sx={{ m: 0, p: 0 }}>
                {group.contacts.map((contact) => <ClubContactRow key={contact.id} contact={contact} phoneShown={phoneShown} emailShown={emailShown} />)}
              </Box>
            </Box>
          ))}
        </Box>
        {contacts.hasNextPage && (
          <Box sx={{ pt: 1.5 }}>
            <Button variant="secondary" size="compact" disabled={contacts.isFetchingNextPage} onClick={() => contacts.fetchNextPage()}>Show More</Button>
          </Box>
        )}
      </>
    )
  }

  const letters = sort === 'name' ? (contacts.lastPage?.letters ?? []) : []
  const letterSx = {
    minWidth: 44,
    minHeight: 44,
    borderRadius: '4px',
    border: `1px solid ${HUB.lineSoft}`,
    fontFamily: HUB.display,
    fontSize: 16,
    fontWeight: 600,
    flex: 'none',
    color: HUB.cream,
    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: alpha(HUB.gold, 0.18), color: HUB.gold, borderColor: HUB.gold },
    '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
  } as const

  return (
    <Box data-testid="hub-club-directory" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5, pt: 1.5, '@media print': { display: 'none' } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' }, gap: 1.5, alignItems: 'center' }}>
        <TextField
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Escape clears the text first; the page-level Escape (footer Back) only runs on an empty box.
            if (event.key === 'Escape' && text) {
              event.preventDefault()
              setText('')
            }
          }}
          label="Search Contacts"
          inputProps={{ 'aria-label': 'Search Contacts', maxLength: 60, 'data-hub-escape': true }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: HUB.muted }} /></InputAdornment>,
            endAdornment: text ? (
              <InputAdornment position="end">
                <IconButton aria-label="Clear search" size="small" onClick={() => setText('')} sx={{ color: HUB.cream }}><ClearIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ ...darkFieldSx, '& .MuiInputBase-root': { ...darkFieldSx['& .MuiInputBase-root'], minHeight: 44 } }}
          fullWidth
        />
        <CompactToggleGroup<ClubContactSort> value={sort} onChange={(next) => { setSort(next); setLetter(null) }} ariaLabel="Contact order" tone="dark">
          <ToggleButton value="name">A To Z</ToggleButton>
          <ToggleButton value="role">By Role</ToggleButton>
        </CompactToggleGroup>
      </Box>

      {letters.length > 0 && (
        <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 0.5, overflowX: 'auto', pb: 0.5 }} role="group" aria-label="Jump to letter">
          {letters.map((value) => (
            <ToggleButton key={value} value={value} selected={letter === value} aria-pressed={letter === value} onChange={() => setLetter(letter === value ? null : value)} sx={letterSx}>{value}</ToggleButton>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: letters.length > 0 ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)' }, columnGap: 2, alignItems: 'start' }}>
        <Box sx={{ minWidth: 0 }}>{body}</Box>
        {letters.length > 0 && (
          <Box role="group" aria-label="Jump to letter" sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.5, position: 'sticky', top: 64, maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' }}>
            {letters.map((value) => (
              <ToggleButton key={value} value={value} selected={letter === value} aria-pressed={letter === value} onChange={() => setLetter(letter === value ? null : value)} sx={{ ...letterSx, minWidth: 36, minHeight: 36 }}>{value}</ToggleButton>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
