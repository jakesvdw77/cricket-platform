import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../../../components/Button'
import { compactButtonSx } from '../../../components/Button/Button'
import type { MyLeagueDto } from '../../../api/myPlayersApi'
import { downloadFile } from '../../../utils/share/downloadFile'
import { generateLeagueSharePoster } from '../../../utils/leagueSchedulePoster'
import { buildMyLeagueShareModel, leagueShareFileName } from '../../../utils/share/shareLeagueData'
import { hubOutlineButton } from './hubStyle'

// docs/specs/123 (Share): one tap makes the standard league Schedule poster (junior leagues on initials) and hands it to the
// share sheet, or downloads the PNG. No dialog, no choices. Hidden when the club has switched the Poster format off.
const canShareFiles = (file: File) => typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

export function HubLeagueShare({ dto, clubName }: { dto: MyLeagueDto; clubName: string | null }) {
  const colour = useTheme().palette.primary.main
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if ((dto.shareDisabledFormats ?? []).includes('POSTER')) return null

  const run = async (mode: 'share' | 'download') => {
    setBusy(true)
    setError(null)
    try {
      const model = buildMyLeagueShareModel({ contents: ['SCHEDULE'], league: dto, clubName, initialsOnly: false })
      const url = await generateLeagueSharePoster(model, colour, { teamLogos: true, footer: false })
      let file: File
      try {
        file = new File([await (await fetch(url)).blob()], leagueShareFileName(model, 'png'), { type: 'image/png' })
      } finally {
        URL.revokeObjectURL(url)
      }
      if (mode === 'share' && canShareFiles(file)) {
        try {
          await navigator.share({ files: [file], title: model.title })
        } catch (caught) {
          if (!(caught instanceof DOMException && caught.name === 'AbortError')) throw caught
        }
      } else {
        downloadFile(file)
      }
    } catch {
      setError('The poster could not be shared. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const canShareProbably = typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
  const btnSx = [compactButtonSx, hubOutlineButton, { minHeight: { xs: 44, md: 36 }, alignSelf: 'center' }] as never
  return (
    <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.5 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {canShareProbably && (
          <Button variant="secondary" size="compact" startIcon={<ShareOutlinedIcon />} disabled={busy} onClick={() => void run('share')} sx={btnSx}>
            {busy ? 'Preparing…' : 'Share'}
          </Button>
        )}
        <Button variant="secondary" size="compact" startIcon={<DownloadOutlinedIcon />} disabled={busy} onClick={() => void run('download')} sx={btnSx}>
          {busy && !canShareProbably ? 'Preparing…' : 'Download'}
        </Button>
      </Box>
      <Typography role="status" aria-live="polite" variant="caption" color="error" sx={{ minHeight: error ? undefined : 0 }}>
        {error}
      </Typography>
    </Box>
  )
}
