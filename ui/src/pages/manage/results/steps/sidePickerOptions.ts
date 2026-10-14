import type { SidePickerOption } from '../../../../components/SidePicker'
import type { ResultSideInfo } from '../resultListHelpers'

export function sidePickerOptions(sides: [ResultSideInfo, ResultSideInfo]): SidePickerOption[] {
  return sides.map((side) => ({ side: side.side, name: side.name, logoSrc: side.logo.src, initials: side.logo.initials }))
}
