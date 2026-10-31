import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useImportHistory } from '../../../api/importApi'
import { ImportHistoryPanel } from '../../../components/ImportHistoryPanel'
import {
  LEAGUE_SCHEDULE_IMPORT_TYPE,
  leagueScheduleInvalidateKeys,
  leagueScheduleScopeKey,
} from '../../../utils/leagueScheduleImport'

export interface ImportHistoryPanelState {
  // How many imports this league and season has (0 until known or without a season).
  total: number
  // "Import History" or "Import History (n)".
  label: string
  open: () => void
  // The side panel, to be mounted once by the page that owns the trigger.
  panel: ReactNode
}

// docs/specs/126-league-page-actions-and-edit-mode.md: the league's import history count and side panel, lifted out of the old
// Imports button so a menu item (the league page's Actions menu) can open it. Each import opens at its report or can be deleted.
export function useImportHistoryPanel(clubId: string, leagueId: string, seasonId: string): ImportHistoryPanelState {
  const navigate = useNavigate()
  const [isOpen, setOpen] = useState(false)
  const scopeKey = leagueScheduleScopeKey(leagueId, seasonId)
  const count = useImportHistory(clubId, { type: LEAGUE_SCHEDULE_IMPORT_TYPE, scopeKey, size: 1 }, Boolean(seasonId))
  const total = seasonId ? (count.data?.totalElements ?? 0) : 0
  return {
    total,
    label: total > 0 ? `Import History (${total})` : 'Import History',
    open: () => setOpen(true),
    panel: (
      <ImportHistoryPanel
        clubId={clubId}
        open={isOpen}
        onClose={() => setOpen(false)}
        type={LEAGUE_SCHEDULE_IMPORT_TYPE}
        scopeKey={scopeKey}
        onOpenReport={(entry) => navigate(`/manage/imports/${entry.id}`)}
        onResume={(entry) => navigate(`/manage/imports/${entry.id}`)}
        invalidateKeys={leagueScheduleInvalidateKeys(clubId, leagueId, seasonId)}
      />
    ),
  }
}
