import { Box, Tab, Tabs } from '@mui/material'
import { CreateAndLinkRecordDialog } from '../../../components/CreateAndLinkRecordDialog'
import { PlayerForm, PLAYER_FORM_ID } from '../../../components/PlayerForm'
import { SelectPlayersDialog } from '../../../components/SelectPlayersDialog'
import type { PlayerPayload } from '../../../api/playerApi'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { AnnounceTeamDialog } from './AnnounceTeamDialog'
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
      <AnnounceTeamDialog
        open={panel.confirmAnnounce}
        candidates={side.players
          .filter((player) => player.playerProfileId !== side.twelfthManPlayerId)
          .map((player) => ({ playerId: player.playerProfileId, name: panel.nameOf(player.playerProfileId) }))}
        captainMissing={!side.captainPlayerId}
        keeperMissing={!side.wicketKeeperPlayerId}
        pending={panel.announcePending}
        errorMessage={panel.announceError}
        onConfirm={panel.announce}
        onClose={panel.closeAnnounce}
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
