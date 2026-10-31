import { useState } from 'react'
import { Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import { copyText } from '../../utils/copyText'
import { Button } from '../Button'

export interface ConvertWithAiPanelProps {
  // The versioned prompt from GET ai-help. Never hard-coded: while it is absent the panel shows a loading or error state.
  prompt?: string
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  // Downloads the template the AI should fill.
  onDownloadTemplate?: () => void
  downloadPending?: boolean
  // The dialog is controlled by the caller, which also starts loading the prompt only once it is open.
  open: boolean
  onClose: () => void
}

// docs/specs/097-import-framework.md, "AI in the import flow", phase 1: help for a file in another format. The platform sends
// nothing to any AI: the manager copies the server's prompt into their own chat with their file and the template attached,
// then uploads the result. Numbered steps, the prompt in a read-only block, Copy prompt, Download template, a privacy line.
export function ConvertWithAiPanel({ prompt, loading = false, error = false, onRetry, onDownloadTemplate, downloadPending = false, open, onClose }: ConvertWithAiPanelProps) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = async () => {
    if (!prompt) return
    const ok = await copyText(prompt)
    setCopied(ok ? 'copied' : 'failed')
    window.setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="convert-with-ai-title">
      <DialogTitle id="convert-with-ai-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        Convert your file with AI
        <IconButton aria-label="Close" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box component="ol" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography component="li" variant="body2">Download the template below.</Typography>
        <Typography component="li" variant="body2">Open your own AI chat and attach your file and the template.</Typography>
        <Typography component="li" variant="body2">Paste the prompt below and send it.</Typography>
        <Typography component="li" variant="body2">Save the file it gives you as Excel or CSV and upload it here.</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button size="compact" variant="secondary" startIcon={<ContentCopyIcon />} disabled={!prompt} onClick={() => void copy()} sx={{ minHeight: { xs: 44, md: 32 } }}>
          Copy prompt
        </Button>
        {onDownloadTemplate && (
          <Button size="compact" variant="secondary" startIcon={<FileDownloadOutlinedIcon />} disabled={downloadPending} onClick={onDownloadTemplate} sx={{ minHeight: { xs: 44, md: 32 } }}>
            Download template
          </Button>
        )}
        <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
          {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Could not copy. Select the prompt below instead.' : ''}
        </Typography>
      </Box>
      {loading && <CircularProgress size={20} aria-label="Loading the prompt" />}
      {error && (
        <Alert severity="error" action={onRetry ? <Button size="compact" variant="ghost" onClick={onRetry}>Try Again</Button> : undefined}>
          We could not load the prompt.
        </Alert>
      )}
      {prompt && (
        <Box
          component="pre"
          tabIndex={0}
          aria-label="Conversion prompt"
          sx={{ m: 0, p: 1.25, height: 200, minHeight: 96, resize: 'vertical', overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {prompt}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <ReportProblemOutlinedIcon aria-hidden sx={{ fontSize: 18, mt: '2px', flex: 'none', color: 'warning.dark' }} />
        <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 600 }}>
          Your file goes to the AI you choose, not through us. Only share it if you are allowed to, especially players&apos; personal details.
        </Typography>
      </Box>
      </DialogContent>
    </Dialog>
  )
}
