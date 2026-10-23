import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { visibleErrors } from '../../../../api/importErrors'
import type { ImportProblem } from '../../../../api/importErrors'
import { Button } from '../../../../components/Button'

export interface ImportProblemAlertProps {
  problem: ImportProblem
  // The chosen source's display name ("Cricket Legend JSON"), for the title of a validation failure.
  sourceName?: string
  // What the manager gave: shapes the sentence that says their input is still there.
  input?: 'paste' | 'file'
  // Offered on a failure that is worth trying again unchanged (the network, a server error).
  onRetry?: () => void
  retrying?: boolean
}

const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '0.75rem' } as const

// One path of the list, a button that copies it so it can be pasted into the editor ("innings[0].batting[0].howOut").
function PathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <ButtonBase
      aria-label={`Copy path ${path}`}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(path)
          .then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          })
          .catch(() => undefined)
      }}
      sx={(theme) => ({
        ...mono,
        px: 0.75,
        py: 0.125,
        borderRadius: 0.5,
        bgcolor: alpha(theme.palette.text.primary, 0.07),
        textAlign: 'left',
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        position: 'relative',
        '&::after': { content: '""', position: 'absolute', top: -10, bottom: -10, left: 0, right: 0 },
        '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
      })}
    >
      {copied ? 'Copied' : path}
    </ButtonBase>
  )
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      role="alert"
      data-testid="import-problem"
      sx={(theme) => ({ border: 1, borderColor: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.07), borderRadius: 2, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 })}
    >
      <Typography variant="body2" fontWeight={700} color="error.main">
        {title}
      </Typography>
      {children}
    </Box>
  )
}

// docs/specs/104-match-results-import-adaptors.md (Source step): one Alert per kind of failure, in plain English, and none of
// them discards the input: the sentence says so. A failed validation lists `path: message` rows (the first 20, each path
// copyable) with "and N more"; an unsupported format names what the source reads; a failure worth trying again offers Retry.
export function ImportProblemAlert({ problem, sourceName, input = 'paste', onRetry, retrying = false }: ImportProblemAlertProps) {
  const kept = input === 'paste' ? 'What you pasted is still here.' : 'Your file is still chosen.'

  if (problem.kind === 'validation') {
    const { shown, more } = visibleErrors(problem.errors, problem.totalErrors)
    return (
      <Frame title={sourceName ? `This ${input === 'paste' ? 'content' : 'file'} is not valid for ${sourceName}` : 'This input is not valid'}>
        <Typography variant="body2">Fix these and try again. {kept}</Typography>
        <Box component="ul" sx={{ m: 0, mt: 1, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {shown.map((error, index) => (
            <Box component="li" key={`${error.path}:${index}`} sx={{ fontSize: '0.8125rem', minWidth: 0 }}>
              {error.path && (
                <>
                  <PathButton path={error.path} />
                  <br />
                </>
              )}
              {error.message}
            </Box>
          ))}
        </Box>
        {more > 0 && (
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, color: 'info.main' }}>
            and {more} more
          </Typography>
        )}
      </Frame>
    )
  }

  if (problem.kind === 'unsupported') {
    return (
      <Frame title="This source does not read that format">
        <Typography variant="body2">{problem.message}</Typography>
        {problem.supported.length > 0 && <Typography variant="body2">It reads: {problem.supported.join(', ')}. {kept}</Typography>}
      </Frame>
    )
  }

  if (problem.kind === 'unreadable') {
    return (
      <Frame title="We couldn't read this">
        <Typography variant="body2">
          {problem.message} {kept}
        </Typography>
      </Frame>
    )
  }

  if (problem.kind === 'too-large') {
    return (
      <Frame title="This is too large">
        <Typography variant="body2">
          {problem.message} {kept}
        </Typography>
      </Frame>
    )
  }

  const retryable = problem.kind === 'network' || problem.kind === 'other'
  return (
    <Frame title={problem.kind === 'network' ? "We couldn't reach the server" : 'That did not work'}>
      <Typography variant="body2">
        {problem.message} {kept}
      </Typography>
      {retryable && onRetry && (
        <Box sx={{ mt: 0.5 }}>
          <Button variant="secondary" size="compact" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Trying again…' : 'Try again'}
          </Button>
        </Box>
      )}
    </Frame>
  )
}
