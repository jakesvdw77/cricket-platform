import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import type { ResultPlayer, ResultSide } from '../../../../api/matchResultApi'
import { Button } from '../../../../components/Button'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { InfoCard } from '../../../../components/InfoCard'
import { bannerSentence, nextToCheck, summariseGuesses } from './guessSummary'
import { useImportReview } from './importReviewContext'

export interface ImportGuessBannerProps {
  // Our players on the scorecard, both sides in list order (the opposition's names are never guesses).
  players: ResultPlayer[]
  scorecardSide: ResultSide
  onScorecardSideChange: (side: ResultSide) => void
  // Clears the flag on every rule-based guess (the page applies it to the draft).
  onConfirmAll: () => void
  disabled?: boolean
}

// docs/specs/104-match-results-import-adaptors.md: the amber notice at the top of the Teams step of an imported draft (an
// InfoCard, not an error): how many names were guesses or left as guests, "Next one to check" which scrolls to and opens the
// next one, and "Confirm all N rule-based guesses" behind a confirm (never offered for a reserved AI level). It shows nothing
// for a result that was not imported or once nothing is left to check.
export function ImportGuessBanner({ players, scorecardSide, onScorecardSideChange, onConfirmAll, disabled = false }: ImportGuessBannerProps) {
  const review = useImportReview()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  // The row being brought into view: opened once its chip is on screen (a different side first has to render).
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!pending) return
    const chip = document.querySelector<HTMLElement>(`[data-guess-key="${pending}"]`)
    if (!chip) return
    chip.scrollIntoView({ block: 'center' })
    chip.click()
    setPending(null)
  }, [pending, scorecardSide])

  const ours = players.filter((player) => !player.opposition)
  const summary = summariseGuesses(ours, review.notes)
  if (review.provider === null || summary.guesses + summary.unresolved === 0) return null

  const next = () => {
    const target = nextToCheck(ours, review.notes, lastKey)
    if (!target) return
    setLastKey(target.key)
    if (target.side !== scorecardSide) onScorecardSideChange(target.side)
    setPending(target.key)
  }

  return (
    <>
      <InfoCard tone="warning" title="Check these names" icon={<ReportProblemOutlinedIcon />} testId="import-guess-banner">
        <Typography variant="body2">{bannerSentence(review.provider, summary)}</Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1 }}>
          <Button onClick={next} disabled={disabled} size="compact">
            Next one to check
          </Button>
          {summary.ruleBased > 0 && (
            <Button variant="secondary" size="compact" onClick={() => setConfirmOpen(true)} disabled={disabled}>
              Confirm all {summary.ruleBased} rule-based {summary.ruleBased === 1 ? 'guess' : 'guesses'}
            </Button>
          )}
        </Box>
      </InfoCard>

      <ConfirmDialog
        open={confirmOpen}
        title={`Confirm all ${summary.ruleBased} rule-based ${summary.ruleBased === 1 ? 'guess' : 'guesses'}?`}
        description="Each name keeps the player it was matched to, and the file's spelling is remembered for your club. Names nobody matched stay as guests until you pick a player."
        confirmLabel="Confirm all"
        onConfirm={() => {
          setConfirmOpen(false)
          onConfirmAll()
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  )
}
