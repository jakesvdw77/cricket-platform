import { CompactSwitch } from '../CompactSwitch'
import { ToolbarToggleChip } from './ToolbarToggleChip'

export interface ToolbarToggleProps {
  // 'row' is the toolbar card on a tablet or desktop (a chip); 'sheet' is the phone Filters sheet (a switch).
  placement: 'row' | 'sheet'
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  // The last of a set that cannot all be off: it stays on and cannot be switched off.
  disabled?: boolean
}

// page-anatomy section 3: one on/off filter, drawn as a toggle chip in the toolbar row and as a switch in the phone's Filters sheet, so a
// page states each toggle once and the placement picks the control.
export function ToolbarToggle({ placement, checked, onChange, label, disabled }: ToolbarToggleProps) {
  return placement === 'row' ? (
    <ToolbarToggleChip pressed={checked} onChange={onChange} label={label} disabled={disabled} />
  ) : (
    <CompactSwitch checked={checked} onChange={onChange} label={label} disabled={disabled} />
  )
}
