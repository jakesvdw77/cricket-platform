import { useEffect, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Typography, useMediaQuery } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { GALLERY_MAX_FILES, useInvalidateGallery, useUploadGalleryPhoto } from '../../api/galleryApi'
import type { GalleryScope } from '../../api/galleryApi'
import { errorDetail } from '../../utils/errorDetail'
import { resizePhoto } from '../../utils/gallery/resizePhoto'
import { Button } from '../Button'
import { CompactSwitch } from '../CompactSwitch'
import { Input } from '../Input'

// docs/specs/157-photo-gallery.md: Add Photos. Up to 10 photos from the camera or the library, one caption and one set of tags for the
// batch. Each photo is made smaller in the browser and sent on its own, so the batch shows progress per photo and a failed photo can
// be sent again. The Hub tags only its held player (a switch); a manager picks any players of the club.
export interface GalleryTagOption {
  id: string
  name: string
}

export interface GalleryUploadDialogProps {
  open: boolean
  onClose: () => void
  scope: GalleryScope
  leagues: GalleryTagOption[]
  teams: GalleryTagOption[]
  // A manager picks players; the Hub passes `myPlayerName` for its one switch instead.
  players?: GalleryTagOption[]
  myPlayerName?: string
}

type Status = 'queued' | 'uploading' | 'done' | 'error'
interface Item {
  id: number
  file: File
  preview: string
  status: Status
  error?: string
}

let nextId = 1

export function GalleryUploadDialog({ open, onClose, scope, leagues, teams, players, myPlayerName }: GalleryUploadDialogProps) {
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const picker = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [caption, setCaption] = useState('')
  const [leagueId, setLeagueId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [playerIds, setPlayerIds] = useState<GalleryTagOption[]>([])
  const [tagMyPlayer, setTagMyPlayer] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const upload = useUploadGalleryPhoto(scope)
  const refresh = useInvalidateGallery(scope)

  const previews = useRef<string[]>([])
  const release = () => {
    previews.current.forEach((url) => URL.revokeObjectURL(url))
    previews.current = []
  }
  useEffect(() => release, [])

  const reset = () => {
    release()
    setItems([])
    setCaption('')
    setLeagueId('')
    setTeamId('')
    setPlayerIds([])
    setNotice(null)
  }
  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const room = GALLERY_MAX_FILES - items.length
    const accepted = Array.from(files).filter((file) => file.type === 'image/jpeg' || file.type === 'image/png').slice(0, Math.max(0, room))
    if (files.length > accepted.length) setNotice(`Only JPEG and PNG photos are added, up to ${GALLERY_MAX_FILES} at a time.`)
    else setNotice(null)
    const added = accepted.map((file) => {
      const preview = URL.createObjectURL(file)
      previews.current.push(preview)
      return { id: nextId++, file, preview, status: 'queued' as Status }
    })
    setItems((current) => [...current, ...added])
    if (picker.current) picker.current.value = ''
  }

  const patch = (id: number, change: Partial<Item>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))

  const send = async () => {
    setBusy(true)
    setNotice(null)
    const tags = { caption, leagueId: leagueId || null, teamId: teamId || null, playerIds: playerIds.map((player) => player.id), tagMyPlayer }
    let failed = 0
    for (const item of items) {
      if (item.status === 'done') continue
      patch(item.id, { status: 'uploading', error: undefined })
      try {
        const photo = await resizePhoto(item.file)
        await upload.mutateAsync({ photo, tags })
        patch(item.id, { status: 'done' })
      } catch (error) {
        failed += 1
        patch(item.id, { status: 'error', error: errorDetail(error, 'This photo could not be sent.') })
      }
    }
    await refresh()
    setBusy(false)
    if (failed === 0) {
      reset()
      onClose()
    } else {
      setNotice(`${failed} ${failed === 1 ? 'photo' : 'photos'} could not be sent. Try again to resend ${failed === 1 ? 'it' : 'them'}.`)
    }
  }

  const waiting = items.filter((item) => item.status !== 'done').length

  return (
    <Dialog open={open} onClose={close} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="gallery-upload-title">
      <DialogTitle id="gallery-upload-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        Add Photos
        <IconButton aria-label="Close" onClick={close} disabled={busy} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          data-testid="gallery-file-input"
          onChange={(event) => addFiles(event.target.files)}
        />
        <Box sx={{ border: 2, borderStyle: 'dashed', borderColor: 'primary.main', borderRadius: 1, p: 2, textAlign: 'center', display: 'grid', gap: 1, justifyItems: 'center' }}>
          <Typography variant="body2" color="primary" fontWeight={600}>Take a photo or choose from your library</Typography>
          <Typography variant="caption" color="text.secondary">JPEG or PNG, up to {GALLERY_MAX_FILES} photos</Typography>
          <Button variant="secondary" onClick={() => picker.current?.click()} disabled={busy || items.length >= GALLERY_MAX_FILES}>Choose Photos</Button>
        </Box>
        {notice && <Alert severity={items.some((item) => item.status === 'error') ? 'error' : 'info'}>{notice}</Alert>}
        {items.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }} data-testid="gallery-upload-strip">
            {items.map((item) => (
              <Box key={item.id} sx={{ position: 'relative', width: 72, height: 72, borderRadius: 0.5, overflow: 'hidden', bgcolor: 'grey.200' }} title={item.error}>
                <Box component="img" src={item.preview} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: item.status === 'done' ? 0.55 : 1 }} />
                {item.status === 'uploading' && <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} />}
                {item.status === 'done' && <Typography sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'primary.main', fontWeight: 700 }}>Sent</Typography>}
                {item.status === 'error' && <Typography sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, bgcolor: 'error.main', color: 'common.white', fontSize: 10, textAlign: 'center' }}>Failed</Typography>}
                {!busy && item.status !== 'done' && (
                  <IconButton
                    size="small"
                    aria-label="Remove photo"
                    onClick={() => setItems((current) => current.filter((other) => other.id !== item.id))}
                    sx={{ position: 'absolute', top: 0, left: 0, p: 0.25, bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.6), color: 'common.white', '&:hover': { bgcolor: (theme: Theme) => alpha(theme.palette.common.black, 0.8) } }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        )}
        <Input label="Caption (optional)" value={caption} onChange={(event) => setCaption(event.target.value)} inputProps={{ maxLength: 200 }} disabled={busy} />
        <Input select label="League" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} disabled={busy}>
          <MenuItem value="">None</MenuItem>
          {leagues.map((league) => <MenuItem key={league.id} value={league.id}>{league.name}</MenuItem>)}
        </Input>
        <Input select label="Team" value={teamId} onChange={(event) => setTeamId(event.target.value)} disabled={busy}>
          <MenuItem value="">None</MenuItem>
          {teams.map((team) => <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>)}
        </Input>
        {players && (
          <Autocomplete
            multiple
            size="small"
            options={players}
            value={playerIds}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_event, next) => setPlayerIds(next.slice(0, 5))}
            disabled={busy}
            renderInput={(params) => <Input {...params} label="Players (up to 5)" />}
          />
        )}
        {myPlayerName && <CompactSwitch label={`Tag ${myPlayerName}`} checked={tagMyPlayer} onChange={setTagMyPlayer} disabled={busy} />}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
        <Button onClick={send} disabled={busy || waiting === 0}>
          {busy ? 'Uploading…' : waiting === 0 ? 'Upload' : `Upload ${waiting} ${waiting === 1 ? 'Photo' : 'Photos'}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
