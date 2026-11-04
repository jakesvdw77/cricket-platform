import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { Button } from '../Button'
import { ChoiceTile } from '../ChoiceTile'

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

// The league page's Teams tab "Add Team" chooser: one of our own teams, an opponent (league) team, or copy teams across. It only chooses; the
// caller opens the existing dialog for the pick.
export function AddTeamChooserDialog({ open, onClose, onChooseOwn, onChooseOpponent, onChooseCopy, copyDisabledReason }: AddTeamChooserDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="add-team-chooser-title">
      <DialogTitle id="add-team-chooser-title">Add a team</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <ChoiceTile
          icon={<GroupsOutlinedIcon color="primary" />}
          label="Our Team"
          description="One of your club's teams playing in this league this season."
          onClick={onChooseOwn}
        />
        <ChoiceTile
          icon={<SportsCricketOutlinedIcon color="primary" />}
          label="Opponent Team"
          description="A team you play against. It is only used in this league and season."
          onClick={onChooseOpponent}
        />
        {onChooseCopy && (
          <ChoiceTile
            icon={<ContentCopyOutlinedIcon color="primary" />}
            label="Copy Teams"
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
