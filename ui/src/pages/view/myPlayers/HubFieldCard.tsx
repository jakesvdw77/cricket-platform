import { Box, Button, Chip, Typography } from '@mui/material'
import DirectionsOutlinedIcon from '@mui/icons-material/DirectionsOutlined'
import { compactButtonSx } from '../../../components/Button/Button'
import type { FieldDto } from '../../../api/myPlayersApi'
import { creamAlpha, blackAlpha } from '../../../brandTokens'
import { HUB, hubOutlineButton } from './hubStyle'
import { isHttpsUrl, joinAddress } from './fieldFormat'

// docs/specs/121 (Field Directory): one read-only field card in the dark console look. Hub-local on purpose (the manager
// FieldCard is untouched). Directions only appears for an https map URL, re-checked here.
const tagSx = { height: 26, borderRadius: '4px', fontSize: 13, fontWeight: 600 } as const

export function HubFieldCard({ field }: { field: FieldDto }) {
  const address = joinAddress(field)
  const owner = field.owner?.trim()
  const mapUrl = isHttpsUrl(field.mapUrl) ? (field.mapUrl as string).trim() : null
  return (
    <Box
      component="article"
      data-testid="hub-field-card"
      sx={{ border: 1, borderColor: HUB.line, bgcolor: creamAlpha(0.07), borderRadius: '4px', p: 2, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}
    >
      <Typography component="h3" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 26, lineHeight: 1.1, letterSpacing: '0.04em', textTransform: 'uppercase', color: HUB.cream, overflowWrap: 'anywhere' }}>
        {field.name}
      </Typography>
      {address && <Typography sx={{ fontSize: 17, overflowWrap: 'anywhere' }}>{address}</Typography>}
      {owner && <Typography sx={{ fontSize: 15, color: HUB.muted, overflowWrap: 'anywhere' }}>Owner: {owner}</Typography>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {field.home ? (
          <Chip size="small" label="Home field" sx={{ ...tagSx, bgcolor: HUB.gold, color: HUB.ink }} />
        ) : (
          <Chip size="small" variant="outlined" label="Away this season" sx={{ ...tagSx, color: HUB.cream, borderColor: HUB.line }} />
        )}
        {field.verified ? (
          <Chip size="small" variant="outlined" label="Address checked" sx={{ ...tagSx, color: HUB.gold, borderColor: HUB.gold }} />
        ) : (
          <Chip size="small" variant="outlined" label="Address not checked yet" sx={{ ...tagSx, color: HUB.muted, borderColor: HUB.lineSoft, bgcolor: blackAlpha(0.2) }} />
        )}
      </Box>
      {mapUrl && (
        <Box sx={{ mt: 'auto', pt: 0.5 }}>
          <Button variant="outlined" size="small" startIcon={<DirectionsOutlinedIcon />} href={mapUrl} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${field.name}`} sx={[compactButtonSx, hubOutlineButton] as never}>
            Directions
          </Button>
        </Box>
      )}
    </Box>
  )
}
