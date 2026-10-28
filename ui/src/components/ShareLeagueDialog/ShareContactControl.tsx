import { Typography } from '@mui/material'
import { CompactSwitch } from '../CompactSwitch'

export interface ShareContactControlProps {
  checked: boolean
  onChange: (next: boolean) => void
}

// docs/specs/122-league-sharing.md (Privacy): phone and email appear only when the manager ticks this for this share. It is
// off every time the dialog opens and is never remembered.
export function ShareContactControl({ checked, onChange }: ShareContactControlProps) {
  return (
    <>
      <CompactSwitch label="Include phone and email" checked={checked} describedBy="share-contact-help" onChange={onChange} />
      <Typography id="share-contact-help" variant="caption" color="text.secondary" component="p">
        Off each time this opens. Only share contact details people expect to be public.
      </Typography>
    </>
  )
}
