import { useEffect, useMemo, useState } from 'react'
import { Box, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Typography } from '@mui/material'
import { Button } from '../Button'
import { Input } from '../Input'
import { LogoAvatar } from '../LogoAvatar'
import type { Player } from '../../api/playerApi'
import type { Section } from '../../api/sectionApi'
import { ageOn, todayIso } from '../../utils/ageEligibility'
import { initialsFromName } from '../../utils/initials'
import { filterSquadCandidates } from '../../utils/squadPickerFilter'

export interface SquadPlayerPickerProps {
  open: boolean
  onClose: () => void
  // active club players not already in this squad (the caller filters)
  candidates: Player[]
  sections: Section[]
  // the team's own section: the filter starts here
  defaultSectionId?: string
  loading?: boolean
  adding?: boolean
  error?: string | null
  onAdd: (playerIds: string[]) => void
}

// docs/specs/142-teams-revamp.md (Add Players to the squad): replaces the one-name dropdown. A club has hundreds of players, so the
// list is searchable and starts on the team's own section; each row shows age and date of birth (two players can share a name) and
// their sections; several players can be ticked and added at once. Age is a label, not a rule.
export function SquadPlayerPicker({ open, onClose, candidates, sections, defaultSectionId = '', loading = false, adding = false, error, onAdd }: SquadPlayerPickerProps) {
  const [search, setSearch] = useState('')
  const [sectionId, setSectionId] = useState(defaultSectionId)
  const [picked, setPicked] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setSearch('')
      setSectionId(sections.some((section) => section.id === defaultSectionId && section.active) ? defaultSectionId : '')
      setPicked([])
    }
  }, [open, defaultSectionId, sections])

  const sectionNames = useMemo(() => new Map(sections.map((section) => [section.id, section.name])), [sections])
  const shown = useMemo(() => filterSquadCandidates(candidates, { search, sectionId }), [candidates, search, sectionId])
  const today = todayIso()
  const toggle = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Players To This Season&apos;s Squad</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1, mb: 1.5 }}>
          <Input label="Search Players" placeholder="Search by name" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ flex: 1 }} />
          <Input select label="Section" value={sectionId} onChange={(event) => setSectionId(event.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All Sections</MenuItem>
            {sections.filter((section) => section.active).map((section) => (
              <MenuItem key={section.id} value={section.id}>
                {section.name}
              </MenuItem>
            ))}
          </Input>
        </Stack>

        <Box data-testid="squad-picker-list" sx={{ maxHeight: 360, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
          {loading ? (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={20} />
            </Box>
          ) : shown.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No players match. Try another section or clear the search.
            </Typography>
          ) : (
            shown.map((player) => {
              const name = `${player.firstName} ${player.lastName}`
              const detail = [
                player.dateOfBirth ? `Age ${ageOn(player.dateOfBirth, today)} · ${player.dateOfBirth}` : 'No date of birth',
                player.sectionIds.map((id) => sectionNames.get(id)).filter(Boolean).join(', '),
              ].filter(Boolean).join(' · ')
              return (
                <Box
                  key={player.id}
                  component="label"
                  data-testid="squad-picker-row"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, cursor: 'pointer', borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <Checkbox size="small" checked={picked.includes(player.id)} onChange={() => toggle(player.id)} inputProps={{ 'aria-label': `${name}, ${detail}` }} />
                  <LogoAvatar src={player.photoUrl} variant="circular" size={32} fontSize="0.6875rem" kind="person" keepTile={!player.photoUrl}>
                    {initialsFromName(name)}
                  </LogoAvatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600} noWrap>
                      {name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {detail}
                    </Typography>
                  </Box>
                </Box>
              )
            })
          )}
        </Box>
        {error && (
          <Typography role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="compact" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button size="compact" disabled={picked.length === 0 || adding} onClick={() => onAdd(picked)}>
          {picked.length > 1 ? `Add ${picked.length} Players` : 'Add Player'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
