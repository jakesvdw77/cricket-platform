import { useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react'
import { Alert, Box, Chip, IconButton, InputBase, ListItemIcon, MenuItem, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined'
import { useQuery } from '@tanstack/react-query'
import { listOppositionNames, resultKeys } from '../../../../api/matchResultApi'
import type { ResultPlayer, ResultSide, Scorecard } from '../../../../api/matchResultApi'
import { Button } from '../../../../components/Button'
import { Input } from '../../../../components/Input'
import { badgeSx } from '../../../../components/RecordCard'
import { ScorecardGrid } from '../../../../components/ScorecardGrid'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { useReorderableRows } from '../../../../hooks/useReorderableRows'
import { MAX_PASTED_NAMES, parseNameList } from '../../../../utils/parseNameList'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { entryPlayerKey, playerRowKey } from '../../../../utils/scorecardPrefill'
import { newRowFill } from '../../../../utils/wicketFill'
import { addPlayer, battingOf, playersOfSide, removePlayer, renamePlayer, setBatting, setSubstitute } from '../scorecardDraft'
import { usePlayerActions } from './usePlayerActions'

export interface OppositionTeamListProps {
  clubId: string
  matchId: string
  seasonId: string
  side: ResultSide
  teamName: string
  scorecard: Scorecard
  // The innings' typed wickets, which decide whether a new name starts as a batter or Did not bat.
  wickets: number | null
  commit: (next: Scorecard) => void
  disabled?: boolean
}

const identityOf = (name: string) => ({ playerProfileId: null, displayName: name, opposition: true })
const lower = (text: string | null | undefined) => (text ?? '').trim().toLowerCase()

// One row's name: an input that renames the player when you leave it or press Enter (a rename follows every row, because
// entries point at the player). Remounted when the stored name changes, so it always shows the stored name.
function NameInput({ player, onRename, onEnter, disabled }: { player: ResultPlayer; onRename: (name: string) => void; onEnter: () => void; disabled?: boolean }) {
  const stored = player.displayName ?? ''
  return (
    <InputBase
      key={`${playerRowKey(player)}:${stored}`}
      defaultValue={stored}
      disabled={disabled}
      onBlur={(event) => {
        const typed = event.target.value.trim()
        if (typed !== stored) {
          if (typed === '') event.target.value = stored
          else onRename(typed)
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        ;(event.target as HTMLInputElement).blur()
        onEnter()
      }}
      inputProps={{ 'aria-label': `Name, ${stored}`, 'data-opp-name': '', 'data-opp-key': playerRowKey(player), maxLength: 120, autoComplete: 'off' }}
      sx={{ width: '100%', fontSize: { xs: '0.875rem', sm: '0.8125rem' }, fontWeight: 600, minHeight: { xs: 44, sm: 30 }, '& input': { py: 0.25 } }}
    />
  )
}

// docs/specs/101-match-results-our-side-scorecard.md, Teams for the opposition (decision 22): a list of NAMES only (no
// profile, no Swap, no Link). Type a name and press Enter for the next row, paste a list (one name per line), reorder by the
// handle or the name popup, mark a substitute, remove. Names used against this opposition before are offered as chips.
// Incomplete or empty is fine: nothing here ever blocks.
export function OppositionTeamList({ clubId, matchId, seasonId, side, teamName, scorecard, wickets, commit, disabled = false }: OppositionTeamListProps) {
  const players = playersOfSide(scorecard, side)
  const batting = battingOf(scorecard, side)
  const containerRef = useRef<HTMLDivElement>(null)
  const [newName, setNewName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const order = new Map(batting.map((entry, index) => [entryPlayerKey(entry), index]))
  const rank = (player: ResultPlayer) => order.get(playerRowKey(player)) ?? Number.MAX_SAFE_INTEGER
  const team = players.filter((player) => !player.substitute).sort((a, b) => rank(a) - rank(b))
  const substitutes = players.filter((player) => player.substitute)
  const rows = [...team, ...substitutes]
  const ids = team.map(playerRowKey)
  const view: PersonName[] = players.map((player) => scorecardPersonName(player))
  const label = usePlayerLabeler(view)
  const existingNames = players.map((player) => player.displayName ?? '')
  const taken = new Set(existingNames.map(lower))

  const suggestionsQuery = useQuery({
    queryKey: resultKeys.oppositionNames(clubId, { matchId }),
    queryFn: () => listOppositionNames(clubId, { matchId }),
    staleTime: 60_000,
    retry: false,
  })
  const suggestions = (suggestionsQuery.data?.content ?? []).filter((suggestion) => !taken.has(lower(suggestion.displayName)))

  const addNames = (names: string[]) => {
    let next = scorecard
    for (const name of names) {
      next = addPlayer(next, side, identityOf(name), newRowFill(battingOf(next, side), wickets).howOut).scorecard
    }
    if (next !== scorecard) commit(next)
  }

  const addPasted = (text: string, clear: () => void) => {
    const parsed = parseNameList(text, existingNames)
    addNames(parsed.names)
    setNotice(
      [
        parsed.truncated ? `Only the first ${MAX_PASTED_NAMES} names were added.` : null,
        parsed.duplicates.length > 0 ? `${parsed.duplicates.length} already on the list ${parsed.duplicates.length === 1 ? 'was' : 'were'} skipped.` : null,
      ]
        .filter(Boolean)
        .join(' ') || null,
    )
    clear()
  }

  const rename = (key: string, name: string) => {
    if (players.some((player) => playerRowKey(player) !== key && lower(player.displayName) === lower(name))) {
      setNotice(`${name} is already on the list.`)
      return
    }
    setNotice(null)
    commit(renamePlayer(scorecard, key, name))
  }

  const inputs = () => Array.from(containerRef.current?.querySelectorAll<HTMLInputElement>('input[data-opp-name]') ?? [])
  const focusAfter = (key: string) => {
    const all = inputs()
    const index = all.findIndex((input) => input.dataset.oppKey === key)
    all[index + 1]?.focus()
  }

  const onReorder = (nextIds: string[]) => {
    const byId = new Map(batting.map((entry) => [entryPlayerKey(entry), entry]))
    commit(setBatting(scorecard, side, nextIds.map((id) => byId.get(id)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))))
  }
  const reorder = useReorderableRows({ ids, onReorder })

  const actions = usePlayerActions({
    clubId,
    seasonId,
    ours: { side, teamId: null },
    scorecard,
    onScorecard: commit,
    ids,
    positionLabel: 'Batting position',
    view,
    onReorder,
    menuSwap: false,
    menuLink: false,
    movable: (key) => ids.includes(key),
    positionDisabledReason: (key) => (ids.includes(key) ? null : 'A substitute is not in the batting order'),
    removeLabel: 'Remove from the list',
    removeDescription: (name) => `This removes ${name} and all their figures. Any dismissal that named them loses the name.`,
    onRemove: (key) => commit(removePlayer(scorecard, key)),
    extraItems: (key, close): ReactNode[] => {
      const player = scorecard.players.find((candidate) => playerRowKey(candidate) === key)
      if (!player) return []
      return [
        <MenuItem
          key="rename"
          onClick={() => {
            close()
            window.setTimeout(() => {
              const input = containerRef.current?.querySelector<HTMLInputElement>(`input[data-opp-key="${CSS.escape(key)}"]`)
              input?.focus()
              input?.select()
            }, 0)
          }}
        >
          <ListItemIcon>
            <DriveFileRenameOutlineIcon fontSize="small" />
          </ListItemIcon>
          Rename
        </MenuItem>,
        <MenuItem
          key="substitute"
          disabled={disabled}
          onClick={() => {
            commit(setSubstitute(scorecard, key, !player.substitute))
            close()
          }}
        >
          <ListItemIcon>
            <PersonOffOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {player.substitute ? 'Move into the team' : 'Mark as substitute'}
        </MenuItem>,
      ]
    },
    disabled,
  })

  const nameCell = (player: ResultPlayer) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <NameInput player={player} onRename={(name) => rename(playerRowKey(player), name)} onEnter={() => focusAfter(playerRowKey(player))} disabled={disabled} />
      {player.substitute && <Chip size="small" label="Substitute" sx={{ ...badgeSx('neutral'), height: { xs: 20, sm: 18 }, fontSize: '0.7rem', flex: 'none' }} />}
    </Box>
  )
  const menuButton = (player: ResultPlayer) => (
    <IconButton
      size="small"
      aria-label={`Options for ${label(scorecardPersonName(player))}`}
      aria-haspopup="menu"
      disabled={disabled}
      onClick={(event) => actions.openMenu(playerRowKey(player), event.currentTarget)}
      sx={{ width: 40, height: 40 }}
    >
      <MoreVertIcon fontSize="small" />
    </IconButton>
  )

  const onTrailingKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    // Enter on an empty last row does nothing; with a name it adds the row and stays here for the next one.
    if (newName.trim() === '') return
    setNotice(null)
    addNames([newName.trim()])
    setNewName('')
  }
  const onTrailingPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (!/\r?\n/.test(pasted.trim())) return
    event.preventDefault()
    addPasted(pasted, () => setNewName(''))
  }

  const empty = rows.length === 0

  return (
    <Box ref={containerRef} sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        Names only: type them in batting order, or paste a list with one name per line. This list is optional and can stay incomplete.
      </Typography>

      {suggestions.length > 0 && (
        <Box data-testid="opposition-suggestions">
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
            Played for {teamName} before · tap to add
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {suggestions.map((suggestion) => (
              <Chip
                key={suggestion.displayName}
                icon={<AddIcon />}
                clickable
                disabled={disabled}
                label={suggestion.uses > 1 ? `${suggestion.displayName} · ${suggestion.uses}` : suggestion.displayName}
                onClick={() => addNames([suggestion.displayName])}
                variant="outlined"
                sx={{ minHeight: 36 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {empty && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
          <Input
            label="Type or paste names, one per line"
            multiline
            minRows={4}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            disabled={disabled}
            helperText={`Up to ${MAX_PASTED_NAMES} at a time. List numbers and bullets are removed.`}
          />
          <Button variant="secondary" size="sm" onClick={() => addPasted(pasteText, () => setPasteText(''))} disabled={disabled || pasteText.trim() === ''}>
            Add names
          </Button>
        </Box>
      )}

      <ScorecardGrid<ResultPlayer>
        ariaLabel={`${teamName} team`}
        playerHeader="Player"
        rows={rows}
        getRowId={playerRowKey}
        columns={[]}
        renderPlayer={nameCell}
        renderPosition={(player, index) => (player.substitute ? '–' : index + 1)}
        renderTrailing={menuButton}
        reorder={reorder}
        reorderDisabled={disabled}
        hideHelp
        emptyMessage="No names yet. Type or paste them above."
        renderCard={(player, index) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 700, width: 22, flex: 'none' }}>
              {player.substitute ? '–' : index + 1}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>{nameCell(player)}</Box>
            {menuButton(player)}
          </Box>
        )}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, px: 1, bgcolor: 'background.paper' }}>
        <AddIcon fontSize="small" sx={{ color: 'text.secondary', flex: 'none' }} />
        <InputBase
          value={newName}
          disabled={disabled}
          placeholder="Type a name, then Enter for the next"
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={onTrailingKeyDown}
          onPaste={onTrailingPaste}
          inputProps={{ 'aria-label': 'Add a name', 'data-opp-name': '', 'data-opp-key': '', maxLength: 120, autoComplete: 'off' }}
          sx={{ flex: 1, minHeight: { xs: 44, sm: 36 }, fontSize: { xs: '0.875rem', sm: '0.8125rem' } }}
        />
      </Box>
      {notice && (
        <Alert severity="info" sx={{ py: 0 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {actions.host}
    </Box>
  )
}
