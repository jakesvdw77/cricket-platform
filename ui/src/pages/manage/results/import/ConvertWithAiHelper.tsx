import { useState } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import { Button } from '../../../../components/Button'

// Copies text, falling back to a hidden textarea where the async clipboard is unavailable (an insecure page, an old browser).
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the textarea route
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const done = document.execCommand('copy')
    document.body.removeChild(area)
    return done
  } catch {
    return false
  }
}

// docs/specs/104-match-results-import-adaptors.md: "Convert it with your own AI" on the Source step. The platform sends
// nothing to any AI: this is only the descriptor's `conversionPrompt`, which the manager copies into their own chat. Collapsed
// by default; the caller renders it only when the selected source has a prompt.
export function ConvertWithAiHelper({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [showPrompt, setShowPrompt] = useState(false)

  const copy = async () => {
    const ok = await copyText(prompt)
    setCopied(ok ? 'copied' : 'failed')
    window.setTimeout(() => setCopied('idle'), 2500)
  }

  return (
    <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', '&::before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 1 } }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Have a different file? Convert it with your own AI
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: 0 }}>
        <Typography variant="body2" color="text.secondary">
          Copy this prompt into your own AI chat with your scorecard attached, then paste the JSON it gives you into Paste.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="secondary" startIcon={<ContentCopyIcon />} onClick={() => void copy()} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}>
            Copy prompt
          </Button>
          <Button variant="ghost" size="sm" aria-expanded={showPrompt} onClick={() => setShowPrompt((open) => !open)} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}>
            {showPrompt ? 'Hide prompt' : 'Show prompt'}
          </Button>
          <Typography variant="caption" color="text.secondary" role="status" aria-live="polite">
            {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Could not copy. Show the prompt and select it instead.' : ''}
          </Typography>
        </Box>
        {showPrompt && (
          <Box
            component="pre"
            tabIndex={0}
            aria-label="Conversion prompt"
            sx={{ m: 0, p: 1.25, maxHeight: 220, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {prompt}
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: 'error.main' }}>
          <ReportProblemOutlinedIcon aria-hidden sx={{ fontSize: 18, mt: '2px', flex: 'none' }} />
          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600 }}>
            Your file goes to the AI you choose, not through us. Only share it if you are allowed to, especially children&apos;s names.
          </Typography>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
