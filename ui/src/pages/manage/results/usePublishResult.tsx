import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { publishResult, resultsKey, validateResult } from '../../../api/matchResultApi'

type Notice = { kind: 'errors' | 'failed'; lines: string[] } | { kind: 'warnings'; matchId: string; lines: string[] }

function bulletList(lines: string[]): ReactNode {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </Box>
  )
}

// docs/specs/100-match-results-core.md: publish a stored draft from a list. Validates first: errors block (and are
// listed), warnings are listed and must be acknowledged ("Publish anyway"), a clean draft publishes at once. A
// success refreshes everything under the results prefix and the Matches list (resultStatus), as the wizard will.
export function usePublishResult(clubId: string) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<Notice | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: resultsKey(clubId) })
    void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
  }

  const publishMutation = useMutation({
    mutationFn: ({ matchId, acknowledged }: { matchId: string; acknowledged: boolean }) =>
      publishResult(clubId, matchId, acknowledged),
    onSuccess: () => {
      setNotice(null)
      refresh()
    },
    onError: () => setNotice({ kind: 'failed', lines: ["The result couldn't be published. Please try again."] }),
  })

  const checkMutation = useMutation({
    mutationFn: (matchId: string) => validateResult(clubId, matchId),
    onSuccess: (validation, matchId) => {
      if (!validation.canPublish) {
        setNotice({ kind: 'errors', lines: validation.errors })
      } else if (validation.warnings.length > 0) {
        setNotice({ kind: 'warnings', matchId, lines: validation.warnings })
      } else {
        publishMutation.mutate({ matchId, acknowledged: false })
      }
    },
    onError: () => setNotice({ kind: 'failed', lines: ["The result couldn't be checked. Please try again."] }),
  })

  const close = () => setNotice(null)

  const dialogs = (
    <>
      <ConfirmDialog
        open={notice?.kind === 'warnings'}
        title="Publish with warnings?"
        description={
          <>
            Please check these before publishing:
            {bulletList(notice?.kind === 'warnings' ? notice.lines : [])}
          </>
        }
        confirmLabel="Publish anyway"
        pendingLabel="Publishing…"
        pending={publishMutation.isPending}
        onConfirm={() => {
          if (notice?.kind === 'warnings') publishMutation.mutate({ matchId: notice.matchId, acknowledged: true })
        }}
        onClose={close}
      />
      <ConfirmDialog
        open={notice?.kind === 'errors' || notice?.kind === 'failed'}
        title={notice?.kind === 'errors' ? "This result can't be published yet" : 'Something went wrong'}
        description={bulletList(notice?.kind === 'warnings' ? [] : (notice?.lines ?? []))}
        acknowledgeOnly
        onClose={close}
      />
    </>
  )

  return { publish: (matchId: string) => checkMutation.mutate(matchId), dialogs }
}
