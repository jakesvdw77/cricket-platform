import { useState } from 'react'
import { Box, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Input } from '../../../components/Input'
import { EmptyState } from '../../../components/EmptyState'
import { Button } from '../../../components/Button'
import { searchClubs } from '../../../api/leadApi'

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN ?? 'localhost:5173'

function goToClubLogin(slug: string) {
  // Same scheme as the current page — HTTPS in prod, HTTP for local dev, since
  // Vite's dev server doesn't serve HTTPS on :5173.
  window.location.href = `${window.location.protocol}//${slug}.${ROOT_DOMAIN}/login`
}

export default function FindYourClubLogin() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const trimmedQuery = query.trim()

  const { data, isFetching } = useQuery({
    queryKey: ['public-clubs', trimmedQuery],
    queryFn: () => searchClubs(trimmedQuery),
    enabled: trimmedQuery.length > 0,
  })

  const hasSearched = trimmedQuery.length > 0
  const results = data ?? []
  const showNoMatches = hasSearched && !isFetching && results.length === 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Input
        label="Search for your club"
        placeholder="Club name or slug"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {/* Platform admins aren't a member of any club (docs/specs/005-admin-login.md) — this is
          the club-free path straight to Keycloak login, separate from the club search above. */}
      <Box>
        <Button onClick={() => navigate('/login')} variant="ghost" size="sm">
          No club? Log in as admin
        </Button>
      </Box>

      {hasSearched && !isFetching && results.length > 0 && (
        <List sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          {results.map((club) => (
            <ListItemButton key={club.slug} onClick={() => goToClubLogin(club.slug)}>
              <ListItemText primary={club.name} secondary={club.slug} />
            </ListItemButton>
          ))}
        </List>
      )}

      {isFetching && (
        <Typography variant="body2" color="text.secondary">
          Searching…
        </Typography>
      )}

      {showNoMatches && (
        <EmptyState
          title="No clubs matched your search"
          description="Can't find your club? Get in touch below and we'll help you out."
          action={
            <Button component="a" href="#lead-capture" variant="secondary" size="sm">
              Go to contact form
            </Button>
          }
        />
      )}
    </Box>
  )
}
