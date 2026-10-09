import { Box, Tab, Tabs } from '@mui/material'
import { BrandIcon } from '../../../components/BrandIcon'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { CreateAndLinkRecordDialog } from '../../../components/CreateAndLinkRecordDialog'
import { PlayerForm, PLAYER_FORM_ID } from '../../../components/PlayerForm'
import { SelectPlayersDialog } from '../../../components/SelectPlayersDialog'
import type { PlayerPayload } from '../../../api/playerApi'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import type { MatchSidePanel } from './useMatchSidePanel'

// The dialogs of the Select team page (docs/specs/076, moved from the Edit Match XI tabs by docs/specs/093): the announce
// confirmation, the Select players dialog and the nested Add new player dialog, all driven by useMatchSidePanel.
export function SelectTeamDialogs({ panel, teamName, matchDate }: { panel: MatchSidePanel; teamName: string; matchDate: string }) {
  const { side, dialog, addPlayer } = panel
  if (!side) {
    return null
  }
  return (
    <>
      <ConfirmDialog
        open={panel.confirmAnnounce}
        title="Announce this team?"
        icon={<BrandIcon name="actions/announce-team" size={40} />}
        description="Announcing marks this team as final: it shows as announced on the match and team sheet, and the team sheet can be shared. Nobody is notified automatically. If you change the selection afterwards, you will need to announce it again."
        confirmLabel="Announce team"
        pendingLabel="Announcing…"
        pending={panel.announcePending}
        onConfirm={panel.announce}
        onClose={() => panel.setConfirmAnnounce(false)}
      />

      {dialog.open && (
        <SelectPlayersDialog
          teamName={teamName}
          kickoffLabel={formatMatchDateTime(matchDate)}
          maxSelected={side.limits.maxSelected}
          initialSelectedIds={side.players.map((player) => player.playerProfileId)}
          pool={dialog.pool}
          poolLoading={dialog.poolLoading}
          poolError={dialog.poolError}
          source={dialog.source}
          onSourceChange={dialog.setSource}
          previousMatches={dialog.previousMatches}
          previousMatchesLoading={dialog.previousMatchesLoading}
          previousMatchId={dialog.previousMatchId}
          onPreviousMatchChange={dialog.setPreviousMatchId}
          previousOrder={dialog.previousOrder}
          previousOrderLoading={dialog.previousOrderLoading}
          search={dialog.search}
          onSearchChange={dialog.setSearch}
          onApply={dialog.apply}
          onRelease={dialog.release}
          onSetAnswer={dialog.setAnswer}
          onAddNewPlayer={addPlayer.openDialog}
          onClose={dialog.close}
        />
      )}

      {/* CreateAndLinkRecordDialog/PlayerForm unmodified: PlayerForm externalises its tab bar, so this renders the same
          small local 3-tab bar PlayerFormPage does. Nested over the Select players dialog. */}
      <CreateAndLinkRecordDialog<PlayerPayload>
        open={addPlayer.open}
        onClose={addPlayer.close}
        title="New player"
        formId={PLAYER_FORM_ID}
        renderForm={(onSubmit) => (
          <>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Tabs
                value={addPlayer.tab}
                onChange={(_event, next: number) => addPlayer.setTab(next as 0 | 1 | 2)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              >
                <Tab label="Basic Info" />
                <Tab label="Contact Info" />
                <Tab label="Cricket Info" />
              </Tabs>
            </Box>
            <PlayerForm activeTab={addPlayer.tab} onSubmit={onSubmit} />
          </>
        )}
        onCreateAndLink={addPlayer.create}
        isPending={addPlayer.pending}
        isError={addPlayer.isError}
        errorMessage={addPlayer.errorMessage}
      />
    </>
  )
}
