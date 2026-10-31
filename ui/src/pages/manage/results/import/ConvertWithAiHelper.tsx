import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import { Button } from '../../../../components/Button'
import { copyText } from '../../../../utils/copyText'

// docs/specs/104-match-results-import-adaptors.md: the Other tab on the Source step, "Convert it with your own AI". The
// platform sends nothing to any AI: this is only the descriptor's `conversionPrompt`, which the manager copies into their own
// chat. The caller renders it only when the selected source has a prompt.
export function ConvertWithAiHelper({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = async () => {
    const ok = await copyText(prompt)
    setCopied(ok ? 'copied' : 'failed')
    window.setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Typography variant="body2" color="text.secondary">
        Have a file in another format? Copy this prompt into your own AI chat with your scorecard attached, then paste the JSON it gives you in the Paste tab.
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="compact" startIcon={<ContentCopyIcon />} onClick={() => void copy()}>
          Copy prompt
        </Button>
        <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
          {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Could not copy. Select the prompt below instead.' : ''}
        </Typography>
      </Box>
      <Box
        component="pre"
        tabIndex={0}
        aria-label="Conversion prompt"
        sx={{ m: 0, p: 1.25, height: 220, minHeight: 96, resize: 'vertical', overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        {prompt}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: 'error.main' }}>
        <ReportProblemOutlinedIcon aria-hidden sx={{ fontSize: 18, mt: '2px', flex: 'none' }} />
        <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
          Your file goes to the AI you choose, not through us. Only share it if you are allowed to, especially children&apos;s names.
        </Typography>
      </Box>
    </Box>
  )
}
