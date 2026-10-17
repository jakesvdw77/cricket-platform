import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button as MuiButton, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined'
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined'
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { errorDetail } from '../../../utils/errorDetail'
import type { MatchResultAction } from '../matches/matchResultHelpers'

export const DELETE_BLOCKED_REASON =
  'A match can only be deleted when nothing is recorded against it: no result, availability poll, squad or team selection. Deactivate it instead.'

export interface MatchHeaderActionsProps {
  // The result actions the match offers today (View / Continue / Capture, and Import). Two open a "Result" menu; one is
  // a plain button (so a published match shows just "View result"); none shows nothing.
  resultActions: MatchResultAction[]
  editTo: string
  active: boolean
  // Resolves when the deactivate / reactivate call has succeeded (the dialog closes then) and rejects when it failed.
  onToggleActive: () => Promise<unknown>
  deletable: boolean
  onDelete: () => void
}

const CONTROL_SX = { minHeight: 44, flex: { xs: 1, md: 'none' }, justifyContent: 'center', minWidth: 0 } as const

// docs/specs/089-match-page-form-and-list-view.md (Match page actions, 2026-10-16): the header carries at most three
// controls, in one row: a Result menu, the filled primary Edit and a More menu (Deactivate / Reactivate, Delete). Team
// actions live on the team cards and Availability on the poll tile.
export function MatchHeaderActions({ resultActions, editTo, active, onToggleActive, deletable, onDelete }: MatchHeaderActionsProps) {
  const [resultAnchor, setResultAnchor] = useState<HTMLElement | null>(null)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState<unknown>(null)

  const closeConfirm = () => {
    setConfirming(false)
    setFailed(null)
  }
  const confirm = async () => {
    setPending(true)
    setFailed(null)
    try {
      await onToggleActive()
      setConfirming(false)
    } catch (error) {
      setFailed(error)
    } finally {
      setPending(false)
    }
  }

  const verb = active ? 'Deactivate' : 'Reactivate'

  return (
    <Box data-testid="match-header-buttons" sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', md: 'auto' } }}>
      {resultActions.length === 1 && (
        <MuiButton component={RouterLink} to={resultActions[0].to} variant="outlined" startIcon={<SportsScoreOutlinedIcon fontSize="small" />} sx={CONTROL_SX}>
          {resultActions[0].label}
        </MuiButton>
      )}
      {resultActions.length > 1 && (
        <>
          <MuiButton
            variant="outlined"
            aria-haspopup="menu"
            aria-expanded={Boolean(resultAnchor)}
            startIcon={<SportsScoreOutlinedIcon fontSize="small" />}
            endIcon={<ArrowDropDownIcon />}
            onClick={(event: MouseEvent<HTMLElement>) => setResultAnchor(event.currentTarget)}
            sx={CONTROL_SX}
          >
            Result
          </MuiButton>
          <Menu anchorEl={resultAnchor} open={Boolean(resultAnchor)} onClose={() => setResultAnchor(null)} MenuListProps={{ 'aria-label': 'Result actions' }}>
            {resultActions.map((action) => (
              <MenuItem key={action.to} component={RouterLink} to={action.to} onClick={() => setResultAnchor(null)} sx={{ minHeight: 44 }}>
                {action.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      <MuiButton component={RouterLink} to={editTo} variant="contained" startIcon={<EditOutlinedIcon fontSize="small" />} sx={CONTROL_SX}>
        Edit
      </MuiButton>

      <IconButton
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={Boolean(moreAnchor)}
        onClick={(event: MouseEvent<HTMLElement>) => setMoreAnchor(event.currentTarget)}
        sx={{ width: 44, height: 44, flex: 'none', border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)} MenuListProps={{ 'aria-label': 'More actions' }}>
        <MenuItem
          sx={{ minHeight: 44 }}
          onClick={() => {
            setMoreAnchor(null)
            setConfirming(true)
          }}
        >
          <ListItemIcon>{active ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />}</ListItemIcon>
          {verb}
        </MenuItem>
        <MenuItem
          aria-disabled={!deletable}
          aria-describedby={deletable ? undefined : 'match-delete-blocked-reason'}
          sx={{ minHeight: 44, color: 'error.main', ...(deletable ? {} : { cursor: 'default', '&:hover': { backgroundColor: 'transparent' } }) }}
          onClick={() => {
            // Kept focusable so a keyboard user reaches it and hears why; it just does nothing while blocked.
            if (!deletable) return
            setMoreAnchor(null)
            onDelete()
          }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
        {!deletable && (
          <Typography
            id="match-delete-blocked-reason"
            component="li"
            role="presentation"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', maxWidth: 320, px: 2, pb: 1, whiteSpace: 'normal' }}
          >
            {DELETE_BLOCKED_REASON}
          </Typography>
        )}
      </Menu>

      <ConfirmDialog
        open={confirming}
        title={active ? 'Deactivate this match?' : 'Reactivate this match?'}
        description={
          <>
            {active ? 'An inactive match is hidden from the active lists. You can reactivate it later.' : 'The match returns to the active lists.'}
            {failed !== null && (
              <Typography role="alert" variant="body2" color="error" sx={{ mt: 1.5 }}>
                {errorDetail(failed, 'Something went wrong. Please try again.')}
              </Typography>
            )}
          </>
        }
        confirmLabel={verb}
        pendingLabel={active ? 'Deactivating…' : 'Reactivating…'}
        destructive={active}
        pending={pending}
        onConfirm={() => void confirm()}
        onClose={closeConfirm}
      />
    </Box>
  )
}
