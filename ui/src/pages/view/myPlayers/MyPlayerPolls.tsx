import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { useLocation } from 'react-router-dom'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import { useMyPlayerPolls, useSaveMyPlayerPollAnswers } from '../../../api/myPlayersApi'
import { LinkedPollCard } from './LinkedPollCard'
import { HUB } from './hubStyle'
import { creamAlpha, blackAlpha } from '../../../brandTokens'

// docs/specs/119 3C: the open availability polls of one player, each a LinkedPollCard.
export function MyPlayerPolls({ playerKey, playerName }: { playerKey: string; playerName: string }) {
  const polls = useMyPlayerPolls(playerKey)
  const save = useSaveMyPlayerPollAnswers(playerKey)
  const [failed, setFailed] = useState<Record<string, 'closed' | 'failed'>>({})
  // A link to #poll-<id> (the scoreboard ticker's poll item) brings that poll's card into view, also when the page is already open.
  const { hash } = useLocation()
  useEffect(() => {
    if (hash.startsWith('#poll-')) document.getElementById(hash.slice(1))?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [hash, polls.data])

  if (polls.isLoading) return <Skeleton variant="rounded" height={120} sx={{ bgcolor: creamAlpha(.12) }} />
  if (polls.isError) return <Alert severity="error">We could not load the availability polls.</Alert>
  const items = polls.data ?? []
  if (items.length === 0) {
    return (
      <Box sx={{ border: 1, borderColor: HUB.line, borderStyle: 'dashed', borderRadius: '4px', p: 2.5, bgcolor: blackAlpha(.22) }}>
        <Typography variant="body2" sx={{ color: HUB.muted }}>
          No open availability polls for {playerName} right now.
        </Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {items.map((poll) => (
        <Box key={poll.pollId} id={`poll-${poll.pollId}`} sx={{ scrollMarginTop: 16 }}>
        <LinkedPollCard
          poll={poll}
          playerName={playerName}
          saving={save.isPending && save.variables?.pollId === poll.pollId}
          error={failed[poll.pollId] ?? null}
          onSave={(answers, onSaved) => {
            setFailed((prev) => {
              const next = { ...prev }
              delete next[poll.pollId]
              return next
            })
            save.mutate(
              { pollId: poll.pollId, answers },
              {
                onSuccess: onSaved,
                onError: (error) => setFailed((prev) => ({ ...prev, [poll.pollId]: isAxiosError(error) && error.response?.status === 409 ? 'closed' : 'failed' })),
              },
            )
          }}
        />
        </Box>
      ))}
    </Box>
  )
}
