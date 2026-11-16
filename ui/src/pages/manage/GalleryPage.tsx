import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Alert, Box, CircularProgress, IconButton, MenuItem, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { GalleryLightbox } from '../../components/GalleryLightbox'
import { GalleryUploadDialog } from '../../components/GalleryUploadDialog'
import { Input } from '../../components/Input'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { ToolbarCard } from '../../components/ToolbarCard'
import { useDeleteGalleryPhoto, useGallery, useGalleryFilters } from '../../api/galleryApi'
import type { GalleryImage, GalleryScope } from '../../api/galleryApi'
import { listLeagues } from '../../api/leagueApi'
import { listPlayers } from '../../api/playerApi'
import { listTeamsForClub } from '../../api/teamApi'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { errorDetail } from '../../utils/errorDetail'
import { formatInstantDateTime } from '../../utils/formatInstantDate'
import { fullName } from '../../utils/playerDisplayName'

// docs/specs/157-photo-gallery.md: the manager's Gallery (Club menu). The same photos as the Player Hub, with who added each one, an
// Add Photos button and a Delete icon on every card (confirmed first). Every list is a server page of 24; Load More asks for the next.

export default function GalleryPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const scope = useMemo<GalleryScope | null>(() => (clubId ? { kind: 'club', clubId } : null), [clubId])
  const [saved, setSaved] = usePersistedListFilters(`gallery:manage:${clubId}`, { leagueId: null as string | null, teamId: null as string | null, playerId: null as string | null })
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search, 300)
  const gallery = useGallery(scope, { q, ...saved })
  const filters = useGalleryFilters(scope)
  const remove = useDeleteGalleryPhoto(scope ?? { kind: 'club', clubId: '' })
  const [viewing, setViewing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<GalleryImage | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // The tag choices of the Add Photos dialog: every league, team and player of the club (read when the dialog opens).
  const leagues = useQuery({ queryKey: ['managed-club', clubId, 'leagues'], queryFn: () => listLeagues(clubId as string), enabled: adding && Boolean(clubId) })
  const teams = useQuery({ queryKey: ['managed-club', clubId, 'teams', {}], queryFn: () => listTeamsForClub(clubId as string), enabled: adding && Boolean(clubId) })
  const players = useQuery({ queryKey: ['managed-club', clubId, 'players', 'gallery-tags'], queryFn: () => listPlayers(clubId as string), enabled: adding && Boolean(clubId) })

  if (!clubId) return <EmptyState title="Not authorized" description="No club is associated with your account." />

  const isFiltered = Boolean(q.trim() || saved.leagueId || saved.teamId || saved.playerId)
  const select = (label: string, value: string | null, options: { id: string; name: string }[], onChange: (next: string | null) => void) => (
    <Box sx={{ minWidth: { xs: '100%', sm: 180 } }}>
      <Input select size="small" label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} inputProps={{ 'aria-label': label }}>
        <MenuItem value="">{`All ${label.toLowerCase()}s`}</MenuItem>
        {options.map((option) => <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>)}
      </Input>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader title="Gallery" action={<Button onClick={() => setAdding(true)}>Add Photos</Button>} />

      <ToolbarCard>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <Box sx={{ flex: '1 1 220px' }}>
            <Input label="Search photos" placeholder="Search photos, teams, players or leagues" value={search} onChange={(event) => setSearch(event.target.value)} inputProps={{ maxLength: 60 }} />
          </Box>
          {select('League', saved.leagueId, filters.data?.leagues ?? [], (next) => setSaved({ leagueId: next }))}
          {select('Team', saved.teamId, filters.data?.teams ?? [], (next) => setSaved({ teamId: next }))}
          {select('Player', saved.playerId, filters.data?.players ?? [], (next) => setSaved({ playerId: next }))}
        </Box>
      </ToolbarCard>

      {gallery.isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress aria-label="Loading photos" /></Box>}
      {gallery.isError && <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => gallery.refetch()}>Retry</Button>}>The photos could not be loaded. Please try again.</Alert>}
      {deleteError && <Alert severity="error" onClose={() => setDeleteError(null)}>{deleteError}</Alert>}
      {gallery.data && gallery.items.length === 0 && (
        <EmptyState title={isFiltered ? 'No photos match' : 'No photos yet'} description={isFiltered ? 'Try different filters or search text.' : 'Add the first photos of your club.'} />
      )}
      {gallery.items.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" data-testid="gallery-count">{gallery.total} {gallery.total === 1 ? 'photo' : 'photos'}</Typography>
          <Box data-testid="gallery-grid" sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
            {gallery.items.map((image, i) => (
              <Box key={image.id} data-testid="gallery-card" sx={{ position: 'relative', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.paper' }}>
                <Box component="button" type="button" onClick={() => setViewing(i)} aria-label={image.caption ?? `Photo ${i + 1}`} sx={{ all: 'unset', display: 'block', width: '100%', cursor: 'zoom-in' }}>
                  <Box component="img" src={image.thumbUrl} alt="" loading="lazy" sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', bgcolor: 'grey.200' }} />
                </Box>
                <IconButton
                  size="small"
                  aria-label="Delete photo"
                  onClick={() => setDeleting(image)}
                  sx={{ position: 'absolute', top: 6, right: 6, bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.6), color: 'common.white', '&:hover': { bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.8) } }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
                <Box sx={{ p: 1, display: 'grid', gap: 0.25 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{image.caption || image.tags.map((tag) => tag.name).join(', ') || 'Untagged'}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>{[image.uploadedByName, formatInstantDateTime(image.uploadedAt)].filter(Boolean).join(' · ')}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
          {gallery.hasNextPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => gallery.fetchNextPage()} disabled={gallery.isFetchingNextPage}>{gallery.isFetchingNextPage ? 'Loading…' : 'Load More'}</Button>
            </Box>
          )}
        </>
      )}

      <GalleryLightbox images={gallery.items} index={viewing} onIndexChange={setViewing} onClose={() => setViewing(null)} canDelete={() => true} onDelete={(image) => setDeleting(image)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this photo?"
        description="It is removed for everyone."
        confirmLabel="Delete Photo"
        pendingLabel="Deleting…"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(deleting.id, {
            onSuccess: () => { setDeleting(null); setViewing(null) },
            onError: (error) => { setDeleting(null); setDeleteError(errorDetail(error, 'The photo could not be deleted.')) },
          })
        }}
        onClose={() => setDeleting(null)}
      />
      {scope && (
        <GalleryUploadDialog
          open={adding}
          onClose={() => setAdding(false)}
          scope={scope}
          leagues={(leagues.data ?? []).map((league) => ({ id: league.id, name: league.name }))}
          teams={(teams.data ?? []).map((team) => ({ id: team.id, name: team.name }))}
          players={(players.data ?? []).map((player) => ({ id: player.id, name: fullName(player) }))}
        />
      )}
    </Box>
  )
}
