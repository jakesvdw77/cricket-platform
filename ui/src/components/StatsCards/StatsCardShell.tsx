import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { STATS_TONES } from '../../brandTokens'
import { FlipCard } from '../FlipCard'
import { basedOnText } from './statsCardOrder'
import { CARD_MIN_HEIGHT, STATS_UI, visuallyHiddenSx } from './statsCardStyle'
import type { CardState, DataTag, StatsBasis } from './statsCardTypes'

// docs/specs/147 section 3: what every stats card has in common, so a card file draws only its two faces. The title row (the card's h3),
// the "Flip" hint, the scope label (so a screenshot is never misleading) and the honesty line "Based on N of M results". CardState
// drives it: ready draws both faces; partial draws both with the card's note; empty draws one non-flipping face with one line; missing
// follows `whenMissing` (render nothing, or the Not captured yet state with no figure and no zero).
// Amendment 2 item 8: the HAVE / PARTLY / NOT CAPTURED chip is no longer drawn on a card. The tag stays as metadata (data-tag, the
// registry). A card that is not ready (partial, empty or missing) gets a quiet amber tint and a thin amber line, and the footer says
// "Some data missing" in words, so colour is never the only cue.
// Amendment 2 item 9: given `onExpand` (the grid passes it on desktop only) a flipping card shows an expand button; given `expanded` it
// fills the box it is in (the grid's overlay), shows a Close button and takes focus into it. Escape and focus return belong to the grid.
// Imports no card and no Hub api module (a guard test pins it).

const TAG_WORD: Record<DataTag, string> = { HAVE: 'Have', PARTLY: 'Partly', NOT_CAPTURED: 'Not Captured' }
const TAG_TONE: Record<DataTag, string> = { HAVE: STATS_TONES.have, PARTLY: STATS_TONES.partly, NOT_CAPTURED: STATS_TONES.notCaptured }

// The tag a card's state implies: a partial scope is PARTLY and a missing one NOT CAPTURED, whatever the card's own tag says. Metadata only.
export function effectiveTag(tag: DataTag, state: CardState): DataTag {
  if (state === 'missing') return 'NOT_CAPTURED'
  if (state === 'partial' && tag === 'HAVE') return 'PARTLY'
  return tag
}

// The old chip, kept exported; the stats card no longer draws it.
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

export const DATA_MISSING_CUE = 'Some data missing'

interface FaceProps {
  title: string
  scopeLabel: string
  // The front's title is the card's h3; the back repeats it as plain text so the card has one heading.
  heading: boolean
  hint?: string
  basis?: StatsBasis | null
  note?: string
  // Some or all data missing: tint, amber line and the written cue.
  lacking: boolean
  expanded: boolean
  // Room at the top right for the expand / close button.
  reserve: boolean
  children: ReactNode
}

function Face({ title, scopeLabel, heading, hint, basis, note, lacking, expanded, reserve, children }: FaceProps) {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: expanded ? 1.5 : 1,
        minWidth: 0,
        height: '100%',
        p: expanded ? '28px 32px 20px' : '18px 18px 14px',
        borderRadius: '22px',
        border: `1px solid ${lacking ? STATS_UI.lackingLine : STATS_UI.lineSoft}`,
        bgcolor: STATS_UI.faceGround,
        ...(lacking ? { backgroundImage: `linear-gradient(${STATS_UI.lackingTint}, ${STATS_UI.lackingTint})` } : {}),
        color: STATS_UI.cream,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, pr: reserve ? 5 : 0 }}>
        <Typography component={heading ? 'h3' : 'p'} sx={{ fontFamily: STATS_UI.display, fontSize: expanded ? 28 : 20, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: STATS_UI.sand, m: 0, minWidth: 0 }}>
          {title}
        </Typography>
      </Box>
      <Typography data-testid="stats-scope" sx={{ fontSize: expanded ? 15 : 13, color: STATS_UI.muted, m: 0 }}>{scopeLabel}</Typography>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: expanded ? 'auto' : 'visible', display: 'grid', alignContent: 'start', gap: expanded ? 1.5 : 1 }}>{children}</Box>
      {note && <Typography data-testid="stats-partial-note" sx={{ fontSize: 13, color: STATS_UI.partly, m: 0 }}>{note}</Typography>}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 20 }}>
        <Box sx={{ minWidth: 0, display: 'grid' }}>
          <Typography data-testid="stats-basis" sx={{ fontSize: 12, color: STATS_UI.muted, m: 0 }}>{basis ? basedOnText(basis) : ''}</Typography>
          {lacking && <Typography data-testid="stats-data-cue" sx={{ fontSize: 12, color: STATS_UI.partly, m: 0 }}>{DATA_MISSING_CUE}</Typography>}
        </Box>
        {hint && (
          <Typography aria-hidden component="span" sx={{ fontFamily: STATS_UI.display, fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: STATS_UI.gold }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

const cornerButtonSx = {
  position: 'absolute',
  top: 10,
  right: 10,
  zIndex: 3,
  width: 36,
  height: 36,
  color: STATS_UI.sand,
  '&:hover': { bgcolor: STATS_UI.lineSoft },
  '&:focus-visible': { outline: `3px solid ${STATS_UI.gold}`, outlineOffset: 2 },
} as const

export interface StatsCardShellProps {
  title: string
  // The card's own tag; metadata only (data-tag follows the state, effectiveTag). It is not drawn.
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
  // Desktop only: given, a flipping card shows the expand button (aria-label "Expand <title>"); it hands back the button for focus return.
  onExpand?: (trigger: HTMLElement) => void
  // True for the instance drawn in the grid's overlay: fills its box, shows Close ("Close <title>") and takes focus.
  expanded?: boolean
  onClose?: () => void
  testId?: string
}

export function StatsCardShell({ title, tag, state, whenMissing = 'hide', scopeLabel, basis, partialNote, summary, front, back, emptyText = 'Not enough data yet.', missingText = 'The scorecard does not record this yet.', scopeKey, onExpand, expanded = false, onClose, testId = 'stats-card' }: StatsCardShellProps) {
  const summaryId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (expanded) closeRef.current?.focus()
  }, [expanded])
  if (state === 'missing' && whenMissing === 'hide') return null

  const articleSx = { position: 'relative', minWidth: 0, height: '100%', minHeight: expanded ? 0 : CARD_MIN_HEIGHT } as const

  if (state === 'empty' || state === 'missing') {
    const text = state === 'empty' ? emptyText : missingText
    return (
      <Box component="article" data-testid={testId} data-state={state} data-tag={effectiveTag(tag, state)} aria-label={title} sx={articleSx}>
        <Face title={title} scopeLabel={scopeLabel} heading lacking expanded={false} reserve={false}>
          <Typography data-testid="stats-state-text" sx={{ fontSize: 16, m: 0 }}>{text}</Typography>
        </Face>
      </Box>
    )
  }

  const lacking = state === 'partial'
  const note = lacking ? partialNote : undefined
  const reserve = expanded || Boolean(onExpand)
  return (
    <Box component="article" data-testid={testId} data-state={state} data-tag={effectiveTag(tag, state)} data-expanded={expanded ? 'true' : 'false'} sx={articleSx}>
      <Typography id={summaryId} sx={visuallyHiddenSx}>{summary}</Typography>
      <FlipCard
        label={title}
        describedBy={summaryId}
        scopeKey={scopeKey}
        testId={`${testId}-flip-card`}
        front={
          <Face title={title} scopeLabel={scopeLabel} heading hint="Flip" basis={basis} note={note} lacking={lacking} expanded={expanded} reserve={reserve}>
            {front}
          </Face>
        }
        back={
          <Face title={title} scopeLabel={scopeLabel} heading={false} hint="Flip Back" basis={basis} note={note} lacking={lacking} expanded={expanded} reserve={reserve}>
            {back}
          </Face>
        }
      />
      {expanded ? (
        <IconButton ref={closeRef} aria-label={`Close ${title}`} data-testid={`${testId}-close`} onClick={onClose} sx={cornerButtonSx}>
          <CloseIcon fontSize="small" />
        </IconButton>
      ) : (
        onExpand && (
          <IconButton aria-label={`Expand ${title}`} data-testid={`${testId}-expand`} onClick={(event) => onExpand(event.currentTarget)} sx={cornerButtonSx}>
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        )
      )}
    </Box>
  )
}
