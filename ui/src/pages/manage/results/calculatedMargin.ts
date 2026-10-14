import type { ResultDraft, ResultMarginType } from '../../../api/matchResultApi'
import { checkMargin } from '../../../utils/marginCheck'
import type { SideNames } from '../../../utils/marginCheck'

// docs/specs/101 (decision 20): the margin of a regular win is worked out from the scores as they are typed, and kept in
// step with them, until the manager edits it ("Edited" with a Reset). The winner chosen on the Result step is never
// changed here: if the scores point at the other side the existing mismatch check says so.

export interface CalculatedMargin {
  type: ResultMarginType
  value: number
}

// The margin the scores give for the winner entered, or null when it cannot be calculated (not a regular win, a winner
// the scores do not support, or an innings missing).
export function calculatedMargin(draft: ResultDraft, names: SideNames): CalculatedMargin | null {
  if (draft.outcomeType !== 'WON' || (draft.decidedBy ?? 'REGULAR') !== 'REGULAR') return null
  const suggestion = checkMargin(draft, names).suggestion
  if (!suggestion || suggestion.outcomeType !== 'WON' || suggestion.decidedBy !== 'REGULAR') return null
  if (!suggestion.marginType || suggestion.marginValue === null) return null
  if (!draft.winningSide || draft.winningSide !== suggestion.winningSide) return null
  return { type: suggestion.marginType, value: suggestion.marginValue }
}

const same = (draft: ResultDraft, calc: CalculatedMargin) => draft.marginType === calc.type && draft.marginValue === calc.value

// True when the margin on the form is the manager's own and differs from the calculation. A loaded margin that differs
// counts as the manager's too (it is never overwritten on opening).
export function marginCorrected(draft: ResultDraft, names: SideNames): boolean {
  const calc = calculatedMargin(draft, names)
  if (!calc || same(draft, calc) || draft.marginValue == null) return false
  return draft.marginCorrected !== false
}

// Applies the calculated margin unless the manager edited it; returns the same draft when nothing changes.
export function withCalculatedMargin(draft: ResultDraft, names: SideNames): ResultDraft {
  const calc = calculatedMargin(draft, names)
  if (!calc || marginCorrected(draft, names)) return draft
  if (same(draft, calc) && draft.marginCorrected === false) return draft
  return { ...draft, marginType: calc.type, marginValue: calc.value, marginCorrected: false }
}
