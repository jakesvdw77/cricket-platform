import { useId } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { STATS_TONES } from '../../brandTokens'
import { FlipCard } from '../FlipCard'
import { basedOnText } from './statsCardOrder'
import { STATS_UI, visuallyHiddenSx } from './statsCardStyle'
import type { CardState, DataTag, StatsBasis } from './statsCardTypes'

// docs/specs/147 section 3: what every stats card has in common, so a card file draws only its two faces. The title row (the card's h3),
// the data-availability chip (HAVE green, PARTLY gold, NOT CAPTURED red; the word is always written, colour is never the only cue),
// the "Flip" hint, the scope label (so a screenshot is never misleading) and the honesty line "Based on N of M results". CardState
// drives it: ready draws both faces; partial draws both and shows PARTLY with the card's note; empty draws one non-flipping face with one
// line; missing follows `whenMissing` (render nothing, or the Not captured yet state with no figure and no zero).
// Imports no card and no Hub api module (a guard test pins it).

const TAG_WORD: Record<DataTag, string> = { HAVE: 'Have', PARTLY: 'Partly', NOT_CAPTURED: 'Not Captured' }
const TAG_TONE: Record<DataTag, string> = { HAVE: STATS_TONES.have, PARTLY: STATS_TONES.partly, NOT_CAPTURED: STATS_TONES.notCaptured }

// The tag actually shown: a partial scope is PARTLY and a missing one NOT CAPTURED, whatever the card's own tag says.
export function effectiveTag(tag: DataTag, state: CardState): DataTag {
  if (state === 'missing') return 'NOT_CAPTURED'
  if (state === 'partial' && tag === 'HAVE') return 'PARTLY'
  return tag
}

export function DataTagChip({ tag }: { tag: DataTag }) {
  const tone = TAG_TONE[tag]
  return (
    <Box
      component="span"
      data-testid="stats-tag"
      data-tag={tag}
      sx={{ flexShrink: 0, px: 1.25, py: '2px', borderRadius: '999px', border: `1px solid ${tone}`, bgcolor: alpha(tone, 0.14), color: tone, fontFamily: STATS_UI.display, fontSize: 13, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.4, whiteSpace: 'nowrap' }}
    >
      {TAG_WORD[tag]}
    </Box>
  )
}

const frameSx = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
  height: '100%',
  p: '18px 18px 14px',
  borderRadius: '22px',
  border: `1px solid ${STATS_UI.lineSoft}`,
  bgcolor: STATS_UI.faceGround,
  color: STATS_UI.cream,
  boxSizing: 'border-box',
} as const

interface FaceProps {
  title: string
  tag: DataTag
  scopeLabel: string
  // The front's title is the card's h3; the back repeats it as plain text so the card has one heading.
  heading: boolean
  hint?: string
  basis?: StatsBasis | null
  note?: string
  children: ReactNode
}

function Face({ title, tag, scopeLabel, heading, hint, basis, note, children }: FaceProps) {
  return (
    <Box sx={frameSx}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Typography component={heading ? 'h3' : 'p'} sx={{ fontFamily: STATS_UI.display, fontSize: 20, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: STATS_UI.sand, m: 0, minWidth: 0 }}>
          {title}
        </Typography>
        <DataTagChip tag={tag} />
      </Box>
      <Typography data-testid="stats-scope" sx={{ fontSize: 13, color: STATS_UI.muted, m: 0 }}>{scopeLabel}</Typography>
      <Box sx={{ flex: 1, minWidth: 0, display: 'grid', alignContent: 'start', gap: 1 }}>{children}</Box>
      {note && <Typography data-testid="stats-partial-note" sx={{ fontSize: 13, color: STATS_TONES.partly, m: 0 }}>{note}</Typography>}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 20 }}>
        <Typography data-testid="stats-basis" sx={{ fontSize: 12, color: STATS_UI.muted, m: 0 }}>{basis ? basedOnText(basis) : ''}</Typography>
        {hint && (
          <Typography aria-hidden component="span" sx={{ fontFamily: STATS_UI.display, fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: STATS_UI.gold }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export interface StatsCardShellProps {
  title: string
  // The card's own tag; the chip shown follows the state (effectiveTag).
  tag: DataTag
  state: CardState
  whenMissing?: 'hide' | 'notCaptured'
  scopeLabel: string
  // N of M for the honesty line; omitted, the line is empty.
  basis?: StatsBasis | null
  // Shown on a partial card (what is partial).
  partialNote?: string
  // One plain sentence: the button's aria-describedby.
  summary: string
  front: ReactNode
  back: ReactNode
  emptyText?: string
  missingText?: string
  // A new scope puts the card back on its front.
  scopeKey?: string
  testId?: string
}

export function StatsCardShell({ title, tag, state, whenMissing = 'hide', scopeLabel, basis, partialNote, summary, front, back, emptyText = 'Not enough data yet.', missingText = 'The scorecard does not record this yet.', scopeKey, testId = 'stats-card' }: StatsCardShellProps) {
  const summaryId = useId()
  if (state === 'missing' && whenMissing === 'hide') return null

  if (state === 'empty' || state === 'missing') {
    const text = state === 'empty' ? emptyText : missingText
    return (
      <Box component="article" data-testid={testId} data-state={state} aria-label={title} sx={{ minWidth: 0 }}>
        <Face title={title} tag={effectiveTag(tag, state)} scopeLabel={scopeLabel} heading>
          <Typography data-testid="stats-state-text" sx={{ fontSize: 16, m: 0 }}>{text}</Typography>
        </Face>
      </Box>
    )
  }

  return (
    <Box component="article" data-testid={testId} data-state={state} sx={{ minWidth: 0 }}>
      <Typography id={summaryId} sx={visuallyHiddenSx}>{summary}</Typography>
      <FlipCard
        label={title}
        describedBy={summaryId}
        scopeKey={scopeKey}
        testId={`${testId}-flip-card`}
        front={
          <Face title={title} tag={effectiveTag(tag, state)} scopeLabel={scopeLabel} heading hint="Flip" basis={basis} note={state === 'partial' ? partialNote : undefined}>
            {front}
          </Face>
        }
        back={
          <Face title={title} tag={effectiveTag(tag, state)} scopeLabel={scopeLabel} heading={false} hint="Flip Back" basis={basis} note={state === 'partial' ? partialNote : undefined}>
            {back}
          </Face>
        }
      />
    </Box>
  )
}
