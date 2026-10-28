import type { ReactNode } from 'react'
import { CompactSwitch } from '../CompactSwitch'
import { ShareControlGroup, ShareInitialsControl } from '../ShareCore'
import { ShareContactControl } from './ShareContactControl'
import type { LeagueScreenProps } from './leagueScreenTypes'

export interface LeagueContentControlsProps extends Pick<LeagueScreenProps, 'model' | 'includeContact' | 'onIncludeContactChange' | 'initials' | 'choices' | 'updateChoices'> {
  // Runs a change that rebuilds editable text after the "Replace your edits?" check (a text screen); omitted, runs at once.
  guard?: (change: () => void) => void
  // Extra Include switches of the screen (Emoji, Hashtags), after the shared ones.
  children?: ReactNode
}

// The Include group every league format screen shares: First names as initials and the contact opt-in (only when League
// details, which names the contacts, is ticked) and Results as the result line (only when Results is ticked).
export function LeagueContentControls({ model, includeContact, onIncludeContactChange, initials, choices, updateChoices, guard = (change) => change(), children }: LeagueContentControlsProps) {
  const hasDetails = model.contents.includes('DETAILS')
  const hasResults = model.contents.includes('RESULTS')
  if (!hasDetails && !hasResults && !children) return null
  return (
    <ShareControlGroup label="Include">
      {hasDetails && <ShareInitialsControl initials={initials} collisions={[]} onChange={(next) => guard(() => initials.setValue(next))} guard={guard} />}
      {hasDetails && <ShareContactControl checked={includeContact} onChange={(next) => guard(() => onIncludeContactChange(next))} />}
      {hasResults && (
        <CompactSwitch
          label="Result line with the margin"
          checked={choices.league.include.results.resultLine}
          onChange={(next) => guard(() => updateChoices({ league: { include: { results: { resultLine: next } } } }))}
        />
      )}
      {children}
    </ShareControlGroup>
  )
}
