import { useEffect, useId, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { ReactNode } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { STATS_TONES } from '../../brandTokens'
import { FlipCard, useFaceActive } from '../FlipCard'
import { CardHeaderSlotContext, ExpandedContext } from './cardHeaderSlot'
import { basedOnText } from './statsCardOrder'
import { EXPANDED_SCALE, STATS_SCALE_VAR, STATS_TYPE, STATS_UI, cardScrollSx, fluid, visuallyHiddenSx } from './statsCardStyle'
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
  // The state is simply empty (nothing to be missing): keep the quiet tint, centre the one line, drop the written cue.
  empty?: boolean
  expanded: boolean
  // Room at the top right for the expand / close button.
  reserve: boolean
  children: ReactNode
}

function Face({ title, scopeLabel, heading, hint, basis, note, lacking, empty = false, expanded, reserve, children }: FaceProps) {
  const active = useFaceActive()
  // The header slot (front only): a state element so the controls portalled into it render once it is mounted.
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  // The scroll position goes back to the top whenever this face stops or starts showing, so a flip never lands half way down a table.
  useEffect(() => {
    if (regionRef.current) regionRef.current.scrollTop = 0
  }, [active])
  // The scrolling region sits above the stretched flip button (so the wheel and touch reach it); a click on plain text in it still flips.
  const flipFromRegion = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) return
    event.currentTarget.closest('article')?.querySelector<HTMLButtonElement>('button[aria-pressed]')?.click()
  }
  // Only a back scrolls inside the card; a front's region clips (a front must fit its card, so an overfull one shows in review).
  const scrolls = !expanded && !heading
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: expanded ? 1.5 : '6px',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        p: expanded ? '24px 28px 24px' : '8px 12px 6px',
        borderRadius: expanded ? '22px' : '14px',
        border: `1px solid ${lacking ? STATS_UI.lackingLine : STATS_UI.lineSoft}`,
        bgcolor: expanded ? STATS_UI.expandedGround : STATS_UI.faceGround,
        ...(lacking ? { backgroundImage: `linear-gradient(${STATS_UI.lackingTint}, ${STATS_UI.lackingTint})` } : {}),
        color: STATS_UI.cream,
        boxSizing: 'border-box',
        overflow: 'hidden',
        // The one scale variable (Amendment 2 item 20): every size in the shared parts and drawings follows it (fluid()). A normal card
        // leaves it at 1; an expanded one sets EXPANDED_SCALE and a chart height of about 55% of the overlay (--stats-exp-h, set by the grid).
        [STATS_SCALE_VAR]: expanded ? EXPANDED_SCALE : 1,
        ...(expanded ? { '--stats-chart-h': 'clamp(260px, calc(var(--stats-exp-h, 560px) * 0.55), 460px)' } : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', pr: reserve ? (expanded ? 6 : 4) : 0 }}>
        <Typography component={heading ? 'h3' : 'p'} sx={{ fontFamily: STATS_UI.display, fontSize: fluid(STATS_TYPE.title, STATS_TYPE.titleExpanded), lineHeight: 1.2, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: STATS_UI.sand, m: 0, minWidth: 0, flex: 1 }}>
          {title}
        </Typography>
        {heading && !empty && <Box ref={setSlot} data-testid="stats-header-actions" sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative', zIndex: 3, '&:empty': { display: 'none' } }} />}
      </Box>
      <Typography data-testid="stats-scope" sx={{ fontSize: fluid(STATS_TYPE.scope, STATS_TYPE.scopeExpanded), lineHeight: 1.25, color: STATS_UI.muted, m: 0 }}>{scopeLabel}</Typography>
      <Box
        ref={regionRef}
        data-flip-interactive={scrolls ? '' : undefined}
        role={scrolls ? 'region' : undefined}
        aria-label={scrolls ? `${title}, details` : undefined}
        tabIndex={scrolls ? (active ? 0 : -1) : undefined}
        onClick={scrolls ? flipFromRegion : undefined}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: heading && !expanded ? 'hidden' : 'auto',
          // A column: the parts keep their natural height, a chart (data-chart-grow) takes the spare height up to its cap, so there is no
          // empty gap between the chart and the footer.
          display: 'flex',
          flexDirection: 'column',
          ...(empty ? { justifyContent: 'center' } : {}),
          gap: expanded ? 1.5 : '6px',
          '& > :not([data-chart-grow])': { flexShrink: 0 },
          ...cardScrollSx,
          // Safety net: an overfull front fades out over its last 12 px instead of hard-cutting (a front is meant to fit; do not rely on this).
          ...(heading && !expanded ? { maskImage: 'linear-gradient(to bottom, black calc(100% - 12px), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 12px), transparent)' } : {}),
          '&:focus-visible': { outline: `2px solid ${STATS_UI.gold}`, outlineOffset: -2 },
        }}
      >
        <ExpandedContext.Provider value={expanded}>
          <CardHeaderSlotContext.Provider value={heading ? slot : null}>{children}</CardHeaderSlotContext.Provider>
        </ExpandedContext.Provider>
      </Box>
      {/* The front carries no note line (the footer cue says it and holds the sentence as its tooltip); the back and an expanded card print the sentence. */}
      {note && (!heading || expanded) && (
        <Typography data-testid="stats-partial-note" sx={{ fontSize: fluid(STATS_TYPE.footer, STATS_TYPE.footerExpanded), lineHeight: 1.25, color: STATS_UI.partly, m: 0, flexShrink: 0 }}>{note}</Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 16, flexShrink: 0 }}>
        <Box sx={{ minWidth: 0, display: 'flex', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', fontSize: fluid(STATS_TYPE.footer, STATS_TYPE.footerExpanded), lineHeight: 1.25 }}>
          <Typography data-testid="stats-basis" component="span" sx={{ fontSize: 'inherit', lineHeight: 'inherit', color: STATS_UI.muted, m: 0, flexShrink: 0 }}>{basis ? basedOnText(basis) : ''}</Typography>
          {lacking && !empty && (
            <Typography data-testid="stats-data-cue" component="span" title={note} sx={{ fontSize: 'inherit', lineHeight: 'inherit', color: STATS_UI.partly, m: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {basis ? '· ' : ''}{DATA_MISSING_CUE}
            </Typography>
          )}
        </Box>
        {hint && (
          <Typography aria-hidden component="span" sx={{ fontFamily: STATS_UI.display, fontSize: fluid(STATS_TYPE.hint, STATS_TYPE.footerExpanded), letterSpacing: '0.14em', textTransform: 'uppercase', color: STATS_UI.muted }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

const cornerButtonSx = {
  position: 'absolute',
  top: 6,
  right: 6,
  zIndex: 3,
  width: 32,
  height: 32,
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
  // Expanded only: what the overlay shows instead of Front and Back side by side (the card's own `Expanded` face).
  expandedBody?: ReactNode
  testId?: string
}

export function StatsCardShell({ title, tag, state, whenMissing = 'hide', scopeLabel, basis, partialNote, summary, front, back, emptyText = 'Not enough data yet.', missingText = 'The scorecard does not record this yet.', scopeKey, onExpand, expanded = false, onClose, expandedBody, testId = 'stats-card' }: StatsCardShellProps) {
  const summaryId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (expanded) closeRef.current?.focus()
  }, [expanded])
  if (state === 'missing' && whenMissing === 'hide') return null

  const articleSx = { position: 'relative', minWidth: 0, height: '100%', minHeight: 0 } as const

  if (state === 'empty' || state === 'missing') {
    const text = state === 'empty' ? emptyText : missingText
    return (
      <Box component="article" data-testid={testId} data-state={state} data-tag={effectiveTag(tag, state)} aria-label={title} sx={articleSx}>
        <Face title={title} scopeLabel={scopeLabel} heading lacking empty={state === 'empty'} expanded={false} reserve={false}>
          <Typography data-testid="stats-state-text" sx={{ fontSize: STATS_TYPE.body, m: 0 }}>{text}</Typography>
        </Face>
      </Box>
    )
  }

  const lacking = state === 'partial'
  const note = lacking ? partialNote : undefined
  const reserve = expanded || Boolean(onExpand)
  if (expanded) {
    // The combined detail view: no flip. The card's own Expanded face, or its Front (left, about 42%) and Back (right) side by side from
    // about 900 px of content, stacked below that; both at the expanded scale, top-aligned.
    return (
      <Box component="article" data-testid={testId} data-state={state} data-tag={effectiveTag(tag, state)} data-expanded="true" sx={articleSx}>
        <Typography id={summaryId} sx={visuallyHiddenSx}>{summary}</Typography>
        <Face title={title} scopeLabel={scopeLabel} heading basis={basis} note={note} lacking={lacking} expanded reserve={reserve}>
          {expandedBody ?? (
            <Box data-testid="stats-expanded-body" sx={{ containerType: 'inline-size', minWidth: 0 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 3, alignItems: 'start', minWidth: 0, '@container (min-width: 900px)': { gridTemplateColumns: 'minmax(0, 42fr) minmax(0, 58fr)', columnGap: 5 } }}>
                <Box data-testid="stats-expanded-front" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>{front}</Box>
                <Box data-testid="stats-expanded-back" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>{back}</Box>
              </Box>
            </Box>
          )}
        </Face>
        <IconButton ref={closeRef} aria-label={`Close ${title}`} data-testid={`${testId}-close`} onClick={onClose} sx={{ ...cornerButtonSx, top: 16, right: 18 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    )
  }
  return (
    <Box component="article" data-testid={testId} data-state={state} data-tag={effectiveTag(tag, state)} data-expanded="false" sx={articleSx}>
      <Typography id={summaryId} sx={visuallyHiddenSx}>{summary}</Typography>
      <FlipCard
        label={title}
        describedBy={summaryId}
        scopeKey={scopeKey}
        testId={`${testId}-flip-card`}
        radius="14px"
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
      {onExpand && (
        <IconButton aria-label={`Expand ${title}`} data-testid={`${testId}-expand`} onClick={(event) => onExpand(event.currentTarget)} sx={cornerButtonSx}>
          <OpenInFullIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  )
}
