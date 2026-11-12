import { Box, Button, Chip, Typography } from '@mui/material'
import DirectionsOutlinedIcon from '@mui/icons-material/DirectionsOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import { compactButtonSx } from '../../../components/Button/Button'
import type { FieldDto } from '../../../api/myPlayersApi'
import { creamAlpha, blackAlpha } from '../../../brandTokens'
import { HUB, hubOutlineButton } from './hubStyle'
import { addressLines, isHttpsUrl } from './fieldFormat'

// docs/specs/121 (Field Directory): one read-only field card in the dark console look. Hub-local on purpose (the manager
// FieldCard is untouched). Directions only appears for an https map URL, re-checked here.
const tagSx = { height: 26, borderRadius: '4px', fontSize: 13, fontWeight: 600 } as const

export function HubFieldCard({ field }: { field: FieldDto }) {
  const lines = addressLines(field)
  const owner = field.owner?.trim()
  const mapUrl = isHttpsUrl(field.mapUrl) ? (field.mapUrl as string).trim() : null
  return (
    <Box
      component="article"
      data-testid="hub-field-card"
      sx={{ border: 1, borderColor: HUB.line, bgcolor: creamAlpha(0.07), borderRadius: '4px', p: 2, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="h3" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 26, lineHeight: 1.1, letterSpacing: '0.04em', textTransform: 'uppercase', color: HUB.cream, overflowWrap: 'anywhere', minWidth: 0 }}>
          {field.name}
        </Typography>
        {/* Owner, 2026-11-12: the verified mark sits top right. */}
        {field.verified ? (
          <Chip size="small" variant="outlined" icon={<VerifiedOutlinedIcon />} label="Verified" data-testid="field-verified" sx={{ ...tagSx, flex: 'none', color: HUB.gold, borderColor: HUB.gold, '& .MuiChip-icon': { color: HUB.gold, fontSize: 16 } }} />
        ) : (
          <Chip size="small" variant="outlined" label="Not Verified" data-testid="field-verified" sx={{ ...tagSx, flex: 'none', color: HUB.muted, borderColor: HUB.lineSoft, bgcolor: blackAlpha(0.2) }} />
        )}
      </Box>
      {lines.length > 0 && (
        <Box data-testid="field-address" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {lines.map((line) => <Typography key={line} sx={{ fontSize: 17, overflowWrap: 'anywhere' }}>{line}</Typography>)}
        </Box>
      )}
      {owner && <Typography sx={{ fontSize: 15, color: HUB.muted, overflowWrap: 'anywhere' }}>Owner: {owner}</Typography>}
      {field.home && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          <Chip size="small" label="Home Field" sx={{ ...tagSx, bgcolor: HUB.gold, color: HUB.ink }} />
        </Box>
      )}
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
