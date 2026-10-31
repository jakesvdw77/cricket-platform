import { ToggleButton, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { CompactSwitch } from '../CompactSwitch'
import { CompactToggleGroup } from '../CompactToggleGroup'
import { ShareControlGroup, ShareInitialsControl } from '../ShareCore'
import { MATCH_LAYOUTS, MATCH_LAYOUT_LABELS as LAYOUT_LABELS, MATCH_SIDE_CHOICES, MATCH_SIDE_LABELS as SIDE_LABELS, usesLineup } from '../../utils/share/matchShareFormats'
import type { MatchLayout, MatchSideChoice } from '../../utils/share/matchShareFormats'
import type { MatchScreenProps } from './matchScreenTypes'

interface Props extends MatchScreenProps {
  // Wraps a change in the "Replace your edits?" check (text screens).
  guard?: (change: () => void) => void
  // Include switches particular to the format, rendered inside the Include group after initials and weather.
  children?: ReactNode
  // The weather switch, driven by the format's own remembered include (the dialog stores one switch for all formats).
  weatherOn: boolean
  onWeatherChange: (next: boolean) => void
  showFacts?: boolean
}

// docs/specs/131 (Control strips): Side and Layout, the Include group (initials with the junior lock, weather with its reason,
// the format's own switches) and the fun facts list. Shared by every match format screen.
export function MatchContentControls(props: Props) {
  const { model, side, sideGaps, layout, onSideChange, onLayoutChange, initials, weatherReason, weatherOn, onWeatherChange, facts, tickedFactIds, onToggleFact, guard = (change) => change(), children, showFacts } = props
  const lineup = usesLineup(model.content)
  const both = side === 'BOTH' && lineup
  const gapText = MATCH_SIDE_CHOICES.map((item) => sideGaps[item]).find(Boolean) ?? null
  return (
    <>
      {lineup && (
        <ShareControlGroup label="Side">
          <CompactToggleGroup value={side} ariaLabel="Side" fullWidthOnPhone onChange={(next: MatchSideChoice) => guard(() => onSideChange(next))}>
            {MATCH_SIDE_CHOICES.map((item) => (
              <ToggleButton key={item} value={item} disabled={Boolean(sideGaps[item])} aria-describedby={sideGaps[item] ? 'match-side-reason' : undefined}>
                {SIDE_LABELS[item]}
              </ToggleButton>
            ))}
          </CompactToggleGroup>
          {gapText && (
            <Typography id="match-side-reason" variant="caption" color="text.secondary">
              {gapText}
            </Typography>
          )}
          {both && (
            <>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ fontWeight: 700 }}>
                Layout
              </Typography>
              <CompactToggleGroup value={layout} ariaLabel="Layout" fullWidthOnPhone onChange={(next: MatchLayout) => guard(() => onLayoutChange(next))}>
                {MATCH_LAYOUTS.map((item) => (
                  <ToggleButton key={item} value={item}>
                    {LAYOUT_LABELS[item]}
                  </ToggleButton>
                ))}
              </CompactToggleGroup>
            </>
          )}
        </ShareControlGroup>
      )}
      <ShareControlGroup label="Include">
        <ShareInitialsControl initials={initials} collisions={[]} onChange={(next) => guard(() => initials.setValue(next))} guard={guard} />
        <CompactSwitch
          label="Include Weather"
          checked={weatherOn && !weatherReason}
          disabled={Boolean(weatherReason)}
          describedBy={weatherReason ? 'match-weather-reason' : undefined}
          onChange={(next) => guard(() => onWeatherChange(next))}
        />
        {weatherReason && (
          <Typography id="match-weather-reason" variant="caption" color="text.secondary">
            {weatherReason}
          </Typography>
        )}
        {children}
      </ShareControlGroup>
      {(model.content === 'FUN_FACTS' || showFacts) && (
        <ShareControlGroup label="Facts">
          {facts.length === 0 && (
            <Typography variant="caption" color="text.secondary" role="status">
              Not enough published results for any fact yet.
            </Typography>
          )}
          {facts.map((fact) => (
            <CompactSwitch key={fact.id} label={fact.label} checked={tickedFactIds.includes(fact.id)} onChange={() => guard(() => onToggleFact(fact.id))} />
          ))}
        </ShareControlGroup>
      )}
    </>
  )
}
