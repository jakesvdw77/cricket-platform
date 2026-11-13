import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Box, Button, CircularProgress, Divider, InputAdornment, TextField, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button as CompactButton } from '../../../components/Button'
import { searchClubs } from '../../../api/leadApi'
import type { ClubSummary } from '../../../api/leadApi'
import { BRAND, FONT_DISPLAY, GOLD_DISC_GRADIENT } from '../../../brandTokens'
import { clubAddress, rootDomain } from '../../../utils/clubFromHost'
import { forgetClub, readLastClub, rememberClub } from '../../../utils/lastClub'
import type { LastClub } from '../../../utils/lastClub'
import { HUB, darkFieldSx, hubGoldButton, hubOutlineButton } from '../myPlayers/hubStyle'

const MIN_LETTERS = 2
const DEBOUNCE_MS = 250

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
  return letters.toUpperCase() || '?'
}

function ClubAvatar({ name }: { name: string }) {
  return (
    <Box
      aria-hidden
      sx={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: GOLD_DISC_GRADIENT, color: BRAND.green900, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}
    >
      {initials(name)}
    </Box>
  )
}

// `onNavigate` lets a host (the Log in dialog) close itself when the visitor follows the in-page link to the contact form.
export default function FindYourClubLogin({ onNavigate }: { onNavigate?: () => void } = {}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [lastClub, setLastClub] = useState<LastClub | null>(readLastClub)
  const trimmed = query.trim()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [trimmed])

  const enabled = debounced.length >= MIN_LETTERS
  const { data, isFetching } = useQuery({
    queryKey: ['public-clubs', debounced],
    queryFn: () => searchClubs(debounced),
    enabled,
    placeholderData: keepPreviousData,
  })

  const typedEnough = trimmed.length >= MIN_LETTERS
  const results: ClubSummary[] = enabled && typedEnough ? (data ?? []) : []
  const settled = enabled && typedEnough && debounced === trimmed && !isFetching
  const showNoMatches = settled && results.length === 0
  const listOpen = results.length > 0
  const optionId = (index: number) => `club-option-${index}`

  function openClub(club: ClubSummary) {
    rememberClub({ slug: club.slug, name: club.name })
    window.location.href = clubAddress(club.slug, '/login')
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!listOpen) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1))
    } else if (event.key === 'Enter' && debounced === trimmed) {
      const target = activeIndex >= 0 ? results[activeIndex] : results.length === 1 ? results[0] : undefined
      if (target) {
        event.preventDefault()
        openClub(target)
      }
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, color: HUB.cream }}>
      {lastClub && (
        <Button
          fullWidth
          variant="contained"
          onClick={() => openClub({ id: '', slug: lastClub.slug, name: lastClub.name })}
          endIcon={<ArrowForwardIcon />}
          sx={{ ...hubGoldButton, minHeight: 56, fontWeight: 700, fontSize: '1.0625rem', textTransform: 'none', justifyContent: 'space-between', px: 2.5 }}
        >
          Continue to {lastClub.name}
        </Button>
      )}

      <Box>
        <TextField
          fullWidth
          size="small"
          autoFocus
          label="Search for your club"
          placeholder="Club name"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          sx={darkFieldSx}
          inputProps={{
            role: 'combobox',
            'aria-expanded': listOpen,
            'aria-controls': 'club-results',
            'aria-autocomplete': 'list',
            'aria-activedescendant': activeIndex >= 0 ? optionId(activeIndex) : undefined,
            autoComplete: 'off',
            style: { minHeight: 20, paddingTop: 12, paddingBottom: 12 },
          }}
          InputProps={{
            endAdornment: isFetching ? (
              <InputAdornment position="end">
                <CircularProgress size={16} aria-label="Searching" sx={{ color: HUB.gold }} />
              </InputAdornment>
            ) : undefined,
          }}
        />
        {!typedEnough && (
          <Typography sx={{ mt: 1, color: HUB.muted, fontSize: 14 }}>Type at least {MIN_LETTERS} letters of your club name</Typography>
        )}
      </Box>

      {listOpen && (
        <Box
          component="ul"
          id="club-results"
          role="listbox"
          aria-label="Matching clubs"
          sx={{ listStyle: 'none', m: 0, p: 0, border: `1px solid ${HUB.line}`, borderRadius: '6px', overflow: 'hidden', bgcolor: alpha(BRAND.ink, 0.5) }}
        >
          {results.map((club, index) => {
            const selected = index === activeIndex
            return (
              <Box
                key={club.slug}
                component="li"
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                onClick={() => openClub(club)}
                onMouseEnter={() => setActiveIndex(index)}
                sx={{
                  minHeight: 56,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${selected ? HUB.gold : 'transparent'}`,
                  bgcolor: selected ? alpha(HUB.gold, 0.16) : 'transparent',
                  '& + &': { borderTop: `1px solid ${HUB.lineSoft}` },
                }}
              >
                <ClubAvatar name={club.name} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontWeight: 600, color: HUB.cream, lineHeight: 1.25 }}>
                    {club.name}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: 13, color: HUB.muted, lineHeight: 1.25 }}>
                    {club.slug}.{rootDomain}
                  </Typography>
                </Box>
                <ArrowForwardIcon aria-hidden sx={{ color: HUB.gold }} fontSize="small" />
              </Box>
            )
          })}
        </Box>
      )}

      {showNoMatches && (
        <Box role="status" sx={{ border: `1px dashed ${HUB.line}`, borderRadius: '6px', p: 2, textAlign: 'center' }}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: '0.04em', textTransform: 'uppercase', color: HUB.cream }}>
            No clubs matched your search
          </Typography>
          <Typography sx={{ color: HUB.muted, fontSize: 14, mb: 1.5 }}>Can&apos;t find your club? Get in touch below and we&apos;ll help you out.</Typography>
          <Button component="a" href="#lead-capture" variant="outlined" onClick={onNavigate} sx={{ ...hubOutlineButton, alignSelf: 'center', minHeight: 44, textTransform: 'none', fontWeight: 600 }}>
            Go to the contact form
          </Button>
        </Box>
      )}

      {/* Platform admins aren't a member of any club (docs/specs/005-admin-login.md): the club-free path straight to
          Keycloak login, kept apart from the club search. */}
      <Divider sx={{ borderColor: HUB.lineSoft }} />
      {/* Owner, 2026-11-13: a parent, guardian or adult player with no account yet creates one here. docs/specs/149 Decision 9: with a
          remembered club the buttons go to that club's own address (the host carries the club), with none they stay club-free. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ color: HUB.muted, fontSize: 14 }}>{lastClub ? `New to ${lastClub.name}?` : 'New here? Parents and players can make an account first.'}</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => (lastClub ? (window.location.href = clubAddress(lastClub.slug, '/register')) : navigate('/register'))}
            data-testid="create-account"
            sx={{ ...hubOutlineButton, minHeight: 44, textTransform: 'none', fontWeight: 600 }}
          >
            Create Account
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => (lastClub ? (window.location.href = clubAddress(lastClub.slug, '/login?idp=google')) : navigate('/login?idp=google'))}
            data-testid="continue-with-google"
            sx={{ ...hubOutlineButton, minHeight: 44, textTransform: 'none', fontWeight: 600 }}
          >
            Continue With Google
          </Button>
          {lastClub && (
            <CompactButton
              variant="ghost"
              size="compact"
              data-testid="not-this-club"
              onClick={() => {
                forgetClub()
                setLastClub(null)
              }}
              sx={{ color: HUB.muted, '&:hover': { color: HUB.cream, backgroundColor: 'transparent' } }}
            >
              Not {lastClub.name}? Search Above
            </CompactButton>
          )}
        </Box>
      </Box>
      <Button variant="outlined" size="small" onClick={() => navigate('/login')} sx={{ ...hubOutlineButton, minHeight: 44, textTransform: 'none', fontWeight: 600 }}>
        Platform admin? Log in here
      </Button>
    </Box>
  )
}
