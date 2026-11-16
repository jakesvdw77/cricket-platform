import { useMemo, useRef, useState } from 'react'
import { Alert, Box, IconButton, InputAdornment, MenuItem, Select, Skeleton, TextField, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SearchIcon from '@mui/icons-material/Search'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { GalleryLightbox } from '../../../components/GalleryLightbox'
import { GalleryUploadDialog } from '../../../components/GalleryUploadDialog'
import { useDeleteGalleryPhoto, useGallery, useGalleryFilters, useGalleryLatest } from '../../../api/galleryApi'
import type { GalleryImage, GalleryScope, GalleryTag } from '../../../api/galleryApi'
import { getMyPlayerLeagues, useMyPlayer } from '../../../api/myPlayersApi'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { creamAlpha } from '../../../brandTokens'
import { errorDetail } from '../../../utils/errorDetail'
import { HubPageHeader } from './HubPageHeader'
import { HUB, darkFieldSx, darkMenuProps } from './hubStyle'

// docs/specs/157-photo-gallery.md: the Player Hub gallery. A looping carousel of the latest 12 photos, a search box with League, Team and
// Player filters, and small thumbnails 24 at a time (Load More). A thumbnail opens the photo large. Anyone with a held player can add
// photos and delete their own. Every list is a server page; the browser never holds more than the pages asked for.
const tile = { display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '3px', bgcolor: creamAlpha(0.12) } as const
const dateText = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Carousel({ images, onOpen }: { images: GalleryImage[]; onOpen: (image: GalleryImage) => void }) {
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const count = images.length
  const at = ((index % count) + count) % count
  const go = (step: number) => setIndex((current) => (((current + step) % count) + count) % count)
  const image = images[at]
  const arrow = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', bgcolor: 'rgba(0,0,0,.5)', color: HUB.cream, display: count > 1 ? 'grid' : 'none', placeItems: 'center', border: 0, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,.7)' } } as const
  return (
    <Box
      component="section"
      aria-label="Latest photos"
      data-testid="gallery-carousel"
      onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null }}
      onTouchEnd={(event) => {
        const start = touchX.current
        touchX.current = null
        const end = event.changedTouches[0]?.clientX
        if (start !== null && end !== undefined && Math.abs(end - start) > 40) go(end < start ? 1 : -1)
      }}
      sx={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', bgcolor: creamAlpha(0.08), height: { xs: 220, sm: 320 } }}
    >
      <Box component="button" type="button" onClick={() => onOpen(image)} aria-label="Open photo" sx={{ all: 'unset', cursor: 'zoom-in', display: 'block', width: '100%', height: '100%' }}>
        <Box component="img" src={image.mediumUrl} alt={image.caption ?? 'Gallery photo'} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </Box>
      <Box component="button" type="button" aria-label="Previous photo" onClick={() => go(-1)} sx={{ ...arrow, left: 10 }}><ChevronLeftIcon /></Box>
      <Box component="button" type="button" aria-label="Next photo" onClick={() => go(1)} sx={{ ...arrow, right: 10 }}><ChevronRightIcon /></Box>
      <Box sx={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '5px', pointerEvents: 'none' }} aria-hidden>
        {images.map((other, i) => <Box key={other.id} component="i" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: i === at ? HUB.gold : 'rgba(255,255,255,.4)' }} />)}
      </Box>
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: '26px 14px 10px', background: 'linear-gradient(transparent, rgba(0,0,0,.72))', pointerEvents: 'none' }}>
        <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 20, lineHeight: 1.1 }}>
          {image.caption || image.tags.map((tag) => tag.name).join(' · ') || 'Photo'}
        </Typography>
        <Typography sx={{ fontSize: 13, color: HUB.muted }}>
          {[image.caption ? image.tags.map((tag) => tag.name).join(', ') : null, dateText(image.uploadedAt)].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
    </Box>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string | null; options: GalleryTag[]; onChange: (value: string | null) => void }) {
  return (
    <Select
      size="small"
      displayEmpty
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
      inputProps={{ 'aria-label': label }}
      MenuProps={darkMenuProps}
      sx={{ ...darkFieldSx, minWidth: { xs: 0, sm: 150 }, flex: { xs: '1 1 30%', sm: '0 0 auto' }, color: HUB.cream, bgcolor: 'rgba(0,0,0,.28)', '& .MuiSvgIcon-root': { color: HUB.muted }, '& .MuiOutlinedInput-notchedOutline': { borderColor: HUB.line } }}
    >
      <MenuItem value="">{`All ${label.toLowerCase()}s`}</MenuItem>
      {options.map((option) => <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>)}
    </Select>
  )
}

export function HubGallery({ playerKey }: { playerKey?: string }) {
  const scope = useMemo<GalleryScope | null>(() => (playerKey ? { kind: 'hub', playerKey } : null), [playerKey])
  const player = useMyPlayer(playerKey)
  const [saved, setSaved] = usePersistedListFilters(`gallery:filters:${playerKey}`, { leagueId: null as string | null, teamId: null as string | null, playerId: null as string | null })
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search, 300)
  const params = { q, ...saved }
  const latest = useGalleryLatest(scope)
  const filters = useGalleryFilters(scope)
  const gallery = useGallery(scope, params)
  const remove = useDeleteGalleryPhoto(scope ?? { kind: 'hub', playerKey: '' })
  const [viewing, setViewing] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<GalleryImage | null>(null)
  // A carousel photo that is not on the loaded grid page yet opens on its own.
  const [single, setSingle] = useState<GalleryImage | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // What the account may tag: the leagues and teams of its held player (the Hub knows no other club lists).
  const myLeagues = useQuery({ queryKey: ['gallery', 'tag-options', playerKey], queryFn: () => getMyPlayerLeagues(playerKey as string), enabled: adding && Boolean(playerKey), retry: false })
  const tagLeagues = (myLeagues.data?.leagues ?? []).map((league) => ({ id: league.id, name: league.name }))
  const tagTeams = Array.from(new Map((myLeagues.data?.leagues ?? []).flatMap((league) => league.myTeams).map((team) => [team.id, { id: team.id, name: team.name }])).values())

  const isFiltered = Boolean(q.trim() || saved.leagueId || saved.teamId || saved.playerId)

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
      <HubPageHeader title="Gallery" actions={<Button onClick={() => setAdding(true)}>Add Photos</Button>} />

      {latest.isLoading && <Skeleton variant="rounded" height={260} sx={{ bgcolor: creamAlpha(0.12) }} />}
      {latest.data && latest.data.length > 0 && !isFiltered && (
        <Carousel
          images={latest.data}
          onOpen={(image) => {
            const at = gallery.items.findIndex((item) => item.id === image.id)
            if (at >= 0) setViewing(at)
            else setSingle(image)
          }}
        />
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search photos, teams, players or leagues"
          inputProps={{ 'aria-label': 'Search photos', maxLength: 60 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: HUB.muted }} /></InputAdornment> }}
          size="small"
          sx={{ ...darkFieldSx, flex: '1 1 220px' }}
        />
        <FilterSelect label="League" value={saved.leagueId} options={filters.data?.leagues ?? []} onChange={(value) => setSaved({ leagueId: value })} />
        <FilterSelect label="Team" value={saved.teamId} options={filters.data?.teams ?? []} onChange={(value) => setSaved({ teamId: value })} />
        <FilterSelect label="Player" value={saved.playerId} options={filters.data?.players ?? []} onChange={(value) => setSaved({ playerId: value })} />
      </Box>

      {gallery.isError && <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => gallery.refetch()}>Retry</Button>}>The photos could not be loaded. Please try again.</Alert>}
      {gallery.isLoading && <Skeleton variant="rounded" height={160} sx={{ bgcolor: creamAlpha(0.12) }} />}
      {gallery.data && (
        <>
          <Typography sx={{ fontSize: 13, color: HUB.muted }} data-testid="gallery-count">{gallery.total} {gallery.total === 1 ? 'photo' : 'photos'}</Typography>
          {gallery.items.length === 0 ? (
            <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2, color: HUB.muted }}>
              {isFiltered ? 'No photos match.' : 'No photos yet. Add the first one.'}
            </Box>
          ) : (
            <Box data-testid="gallery-grid" sx={{ display: 'grid', gap: '6px', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' } }}>
              {gallery.items.map((image, i) => (
                <Box key={image.id} sx={{ position: 'relative' }}>
                  <Box component="button" type="button" onClick={() => setViewing(i)} aria-label={image.caption ?? `Photo ${i + 1}`} sx={{ all: 'unset', cursor: 'zoom-in', display: 'block', width: '100%', '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}>
                    <Box component="img" src={image.thumbUrl} alt="" loading="lazy" sx={tile} />
                  </Box>
                  {/* Your own photo: a small trash icon (the same confirm as the large view) and a quiet "Yours" marker. */}
                  {image.mine && (
                    <>
                      <IconButton
                        size="small"
                        aria-label="Delete your photo"
                        onClick={() => setDeleting(image)}
                        sx={{ position: 'absolute', top: 4, right: 4, p: 0.5, bgcolor: 'rgba(0,0,0,.6)', color: HUB.cream, '&:hover': { bgcolor: 'rgba(0,0,0,.85)' }, '&:focus-visible': { outline: `2px solid ${HUB.gold}` } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                      <Box component="span" aria-hidden sx={{ position: 'absolute', left: 4, bottom: 4, px: 0.75, borderRadius: '8px', fontSize: 11, fontWeight: 600, bgcolor: 'rgba(0,0,0,.6)', color: HUB.sand, pointerEvents: 'none' }}>Yours</Box>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          )}
          {gallery.hasNextPage && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => gallery.fetchNextPage()} disabled={gallery.isFetchingNextPage}>{gallery.isFetchingNextPage ? 'Loading…' : 'Load More'}</Button>
            </Box>
          )}
        </>
      )}
      {deleteError && <Alert severity="error" onClose={() => setDeleteError(null)}>{deleteError}</Alert>}

      <GalleryLightbox
        images={single ? [single] : gallery.items}
        index={single ? 0 : viewing}
        onIndexChange={setViewing}
        onClose={() => { setViewing(null); setSingle(null) }}
        canDelete={(image) => image.mine}
        onDelete={(image) => setDeleting(image)}
      />
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
            onSuccess: () => { setDeleting(null); setViewing(null); setSingle(null) },
            onError: (error) => { setDeleting(null); setDeleteError(errorDetail(error, 'The photo could not be deleted.')) },
          })
        }}
        onClose={() => setDeleting(null)}
      />
      {scope && (
        <GalleryUploadDialog open={adding} onClose={() => setAdding(false)} scope={scope} leagues={tagLeagues} teams={tagTeams} myPlayerName={player.data?.firstName} />
      )}
    </Box>
  )
}
