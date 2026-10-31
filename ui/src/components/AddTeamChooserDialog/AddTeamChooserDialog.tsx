import { ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { Button } from '../Button'

export interface AddTeamChooserDialogProps {
  open: boolean
  onClose: () => void
  // "Our team": one of the club's own teams playing in this league.
  onChooseOwn: () => void
  // "Opponent team": a league team for this league and season.
  onChooseOpponent: () => void
  // "Copy teams": bring league teams across from another league or season. The tile is shown only when this is given.
  onChooseCopy?: () => void
  // When set, the Copy teams tile is disabled and shows this reason.
  copyDisabledReason?: string
}

interface ChoiceTileProps {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
  disabled?: boolean
}

// A large tile button: at least 44 px high, a native button so Tab, Enter and Space work.
function ChoiceTile({ icon, label, description, onClick, disabled }: ChoiceTileProps) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.5,
        width: '100%',
        minHeight: 72,
        px: 2,
        py: 1.5,
        textAlign: 'left',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        '&.Mui-disabled': { opacity: 0.6 },
        '&:hover': { borderColor: 'primary.main', boxShadow: 2 },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <span aria-hidden style={{ display: 'flex' }}>
        {icon}
      </span>
      <span>
        <Typography variant="subtitle2" component="span" display="block" fontWeight={700}>
          {label}
        </Typography>
        <Typography variant="caption" component="span" display="block" color="text.secondary">
          {description}
        </Typography>
      </span>
    </ButtonBase>
  )
}

// The league page's Teams tab "Add Team" chooser: one of our own teams, an opponent (league) team, or copy teams across. It only chooses; the
// caller opens the existing dialog for the pick.
export function AddTeamChooserDialog({ open, onClose, onChooseOwn, onChooseOpponent, onChooseCopy, copyDisabledReason }: AddTeamChooserDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="add-team-chooser-title">
      <DialogTitle id="add-team-chooser-title">Add a team</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <ChoiceTile
          icon={<GroupsOutlinedIcon color="primary" />}
          label="Our team"
          description="One of your club's teams playing in this league this season."
          onClick={onChooseOwn}
        />
        <ChoiceTile
          icon={<SportsCricketOutlinedIcon color="primary" />}
          label="Opponent team"
          description="A team you play against. It is only used in this league and season."
          onClick={onChooseOpponent}
        />
        {onChooseCopy && (
          <ChoiceTile
            icon={<ContentCopyOutlinedIcon color="primary" />}
            label="Copy teams"
            description={copyDisabledReason ? `Bring league teams across from another league or season. ${copyDisabledReason}` : 'Bring league teams across from another league or season.'}
            onClick={onChooseCopy}
            disabled={Boolean(copyDisabledReason)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
