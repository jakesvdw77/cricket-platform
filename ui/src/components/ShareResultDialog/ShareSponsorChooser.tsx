import { Avatar, Box, Checkbox, FormControlLabel, FormGroup, Typography } from '@mui/material'
import type { Sponsor } from '../../api/sponsorApi'

export interface ShareSponsorChooserProps {
  sponsors: Sponsor[]
  selectedIds: string[]
  max: number
  onChange: (ids: string[]) => void
}

// docs/specs/114-share-result.md (Logos and footer): the sponsors to feature, ticked by the manager, at most `max`.
// Lists active sponsors with a logo only (the caller passes them). Internal to ShareResultDialog.
export function ShareSponsorChooser({ sponsors, selectedIds, max, onChange }: ShareSponsorChooserProps) {
  if (sponsors.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No sponsors with a logo to choose from.
      </Typography>
    )
  }
  const full = selectedIds.length >= max
  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...selectedIds, id].slice(0, max) : selectedIds.filter((item) => item !== id))
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Typography component="legend" variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
        Sponsors to show (up to {max}): {selectedIds.length} chosen
      </Typography>
      <FormGroup>
        {sponsors.map((sponsor) => {
          const checked = selectedIds.includes(sponsor.id)
          return (
            <FormControlLabel
              key={sponsor.id}
              sx={{ minHeight: { xs: 44, sm: 36 }, ml: 0 }}
              control={
                <Checkbox size="small" checked={checked} disabled={!checked && full} onChange={(event) => toggle(sponsor.id, event.target.checked)} />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar variant="rounded" src={sponsor.logoUrl ?? undefined} alt="" sx={{ width: 28, height: 28, bgcolor: 'background.paper' }} imgProps={{ style: { objectFit: 'contain' } }} />
                  <Typography component="span" sx={{ fontSize: '0.85rem' }}>
                    {sponsor.name}
                  </Typography>
                </Box>
              }
            />
          )
        })}
      </FormGroup>
      {full && (
        <Typography variant="caption" color="text.secondary">
          The most you can show is {max}. Untick one to choose another.
        </Typography>
      )}
    </Box>
  )
}
