import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link as MuiLink, Stack, Tooltip, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import StadiumOutlinedIcon from '@mui/icons-material/StadiumOutlined'
import { usePermissions } from '../../auth/permissions'
import { Button } from '../../components/Button'
import { InfoCard } from '../../components/InfoCard'
import { Input } from '../../components/Input'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useFieldHomeLink } from '../../hooks/useFieldHomeLink'
import { listPlayingAreas, playingAreasKey } from '../../api/playingAreaApi'
import type { PlayingArea } from '../../api/playingAreaApi'
import { cityLine, streetLine } from '../../utils/fieldLabels'

const FIELDS_PATH = '/manage/fixtures/fields'

export interface OurFieldsCardProps {
  clubId: string
  // docs/specs/127: wraps an in-app destination with the page it leaves from as its origin.
  leaveTo: (destination: string) => string
}

// docs/specs/151, slice F: the club's own fields on the Club Profile page. The card lists them (name, street and town, each opening the
// field's page); with Matches Edit it also links another field from the directory and removes one from the shortlist. Removing is
// only the shortlist: matches keep the field (docs/specs/099).
export function OurFieldsCard({ clubId, leaveTo }: OurFieldsCardProps) {
  const canEdit = usePermissions().can('MATCHES_EDIT')
  const [linkOpen, setLinkOpen] = useState(false)
  const homeLink = useFieldHomeLink(clubId)
  const mine = useQuery({
    queryKey: [...playingAreasKey(clubId), 'club-profile-mine'],
    queryFn: () => listPlayingAreas(clubId, { mine: true, size: 100 }),
    enabled: Boolean(clubId),
  })
  const fields = mine.data?.content ?? []

  return (
    <InfoCard
      flat
      testId="our-fields-card"
      title="Our Fields"
      icon={<StadiumOutlinedIcon />}
      headerAction={
        canEdit ? (
          <Button size="compact" variant="secondary" onClick={() => setLinkOpen(true)} data-testid="link-field">
            Link A Field
          </Button>
        ) : undefined
      }
    >
      {mine.isPending ? null : fields.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No fields yet. {canEdit ? 'Link the fields your club plays on.' : ''}
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {fields.map((field) => (
            <Box
              component="li"
              key={field.id}
              data-testid="our-field-row"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <MuiLink component={RouterLink} to={leaveTo(`${FIELDS_PATH}/${field.id}`)} underline="hover" color="inherit" sx={{ fontWeight: 600 }}>
                  {field.name}
                </MuiLink>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere' }}>
                  {[streetLine(field), cityLine(field)].filter(Boolean).join(', ') || 'No address on file'}
                </Typography>
              </Box>
              {canEdit && (
                <Tooltip title="Remove from Our Fields">
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Remove ${field.name} from Our Fields`}
                      onClick={() => homeLink.toggleHome(field)}
                      disabled={homeLink.pendingId === field.id}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
      )}
      <LinkFieldDialog clubId={clubId} open={linkOpen} onClose={() => setLinkOpen(false)} leaveTo={leaveTo} onLink={homeLink.toggleHome} pendingId={homeLink.pendingId} />
      {homeLink.dialog}
    </InfoCard>
  )
}

interface LinkFieldDialogProps {
  clubId: string
  open: boolean
  onClose: () => void
  leaveTo: (destination: string) => string
  onLink: (field: PlayingArea) => void
  pendingId: string | null
}

// Search the whole directory by name or town and add a field to the club. The dialog stays open, so several fields can be added in a
// row; a field already linked drops out of the results once the list refreshes.
function LinkFieldDialog({ clubId, open, onClose, leaveTo, onLink, pendingId }: LinkFieldDialogProps) {
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 300)
  const results = useQuery({
    queryKey: [...playingAreasKey(clubId), 'link-search', q],
    queryFn: () => listPlayingAreas(clubId, { q: q || undefined, size: 20 }),
    enabled: open && Boolean(clubId),
  })
  const candidates = (results.data?.content ?? []).filter((field) => !field.linkedHome)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="link-field-title">
      <DialogTitle id="link-field-title">Link A Field To Your Club</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Input label="Search fields" placeholder="Name or town" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
          {results.isPending ? null : candidates.length === 0 ? (
            <Typography variant="body2" color="text.secondary" data-testid="link-field-empty">
              {q ? 'No fields match that search.' : 'Every field in the directory is already one of yours.'}{' '}
              <MuiLink component={RouterLink} to={leaveTo(`${FIELDS_PATH}/new`)} underline="always">
                Create New Field
              </MuiLink>
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {candidates.map((field) => (
                <Box component="li" key={field.id} data-testid="link-field-result" sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {field.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ overflowWrap: 'anywhere' }}>
                      {[streetLine(field), cityLine(field), field.ownerName].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Button size="compact" variant="secondary" onClick={() => onLink(field)} disabled={pendingId === field.id}>
                    {pendingId === field.id ? 'Adding…' : 'Add'}
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button size="compact" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}
