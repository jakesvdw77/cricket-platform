import { Box, Checkbox, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

// The amber tick row of the import wizard: a required acknowledgement the manager gives before going on ("Replace the existing
// draft" on the Teams step, "I have checked this is the right match" on the Match step). One look, one place.
export function AcknowledgementTick({
  id,
  title,
  detail,
  checked,
  onChange,
  disabled,
}: {
  id: string
  title: string
  detail?: string
  checked: boolean
  onChange: (ticked: boolean) => void
  disabled?: boolean
}) {
  return (
    <Box
      sx={(theme) => ({ border: 1, borderColor: alpha(theme.palette.warning.main, 0.5), bgcolor: alpha(theme.palette.warning.main, 0.06), borderRadius: 2, p: { xs: 1.25, md: 1.75 }, display: 'flex', gap: 1, alignItems: detail ? 'flex-start' : 'center', maxWidth: { md: 560 } })}
    >
      <Checkbox
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        inputProps={{ 'aria-labelledby': `${id}-title`, ...(detail ? { 'aria-describedby': `${id}-detail` } : {}) }}
        sx={{ p: 1, mt: detail ? -0.5 : 0, ml: -0.5 }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography id={`${id}-title`} variant="body2" fontWeight={700}>
          {title}
        </Typography>
        {detail && (
          <Typography id={`${id}-detail`} variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {detail}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
