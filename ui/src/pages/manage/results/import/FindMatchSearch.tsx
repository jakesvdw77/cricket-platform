import { useMemo, useState } from 'react'
import { Box, Button as MuiButton, Chip, Collapse, TextField, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import { useQuery } from '@tanstack/react-query'
import { listMatches } from '../../../../api/matchApi'
import { listLeagues } from '../../../../api/leagueApi'
import { listSections } from '../../../../api/sectionApi'
import { listTeamsForClub } from '../../../../api/teamApi'
import type { Match } from '../../../../api/matchApi'
import { badgeSx } from '../../../../components/RecordCard'
import { SectionTreeSelect } from '../../../../components/SectionTreeSelect'
import { TileChoiceGroup } from '../../../../components/TileChoiceGroup'
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue'
import { formatMatchDateTime } from '../../../../utils/matchDateTime'
import { sectionPath } from '../../../../utils/sectionPath'

const PAGE_SIZE = 50
const MAX_PAGES = 6
const MAX_ROWS = 20
const DAYS_BACK = 60
const DAYS_AHEAD = 7
const DAY_MS = 24 * 60 * 60 * 1000

interface FindMatchSearchProps {
  clubId: string
  // Matches already listed as candidates (not offered twice).
  listedIds: string[]
  // The manager chose one: the page makes the preview again for it and selects it.
  onFound: (match: Match) => void
  disabled?: boolean
  // Open from the start (when no candidate was proposed).
  defaultOpen?: boolean
}

// docs/specs/104-match-results-import-adaptors.md, step 2 Match: "Find another match". The proposed candidates only cover
// matches near the file's date and a team name in the file can differ from the club's ("PTA A" and "Pretoria A"), so this
// opens with a list instead of a search box: the club's recent matches that have no result yet (60 days back to a week ahead,
// newest first, never one with a result of any status), narrowed by section and, optionally, by team name. Both narrowing
// filters are the Matches list's own backend parameters. A found match carries no evidence chips (nothing was compared);
// choosing one re-runs the preview for it, so its team mapping and status come from the server.
export function FindMatchSearch({ clubId, listedIds, onFound, disabled = false, defaultOpen = false }: FindMatchSearchProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [text, setText] = useState('')
  const [sectionId, setSectionId] = useState<string | null>(null)
  const search = useDebouncedValue(text.trim(), 300)
  // Fixed for the life of the section, so the query key does not change every render.
  const span = useMemo(() => {
    const now = Date.now()
    return { from: now - DAYS_BACK * DAY_MS, to: now + DAYS_AHEAD * DAY_MS }
  }, [])

  const sectionsQuery = useQuery({ queryKey: ['managed-club', clubId, 'sections'], queryFn: () => listSections(clubId), enabled: open })
  const leaguesQuery = useQuery({ queryKey: ['managed-club', clubId, 'leagues'], queryFn: () => listLeagues(clubId), enabled: open })
  const teamsQuery = useQuery({ queryKey: ['managed-club', clubId, 'teams'], queryFn: () => listTeamsForClub(clubId), enabled: open })

  // Newest first from the server; pages are read until one reaches back past the window (a bounded read, never the whole history).
  const query = useQuery({
    queryKey: ['managed-club', clubId, 'matches', 'import-find', sectionId, search],
    queryFn: async () => {
      const matches: Match[] = []
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await listMatches(clubId, { page, size: PAGE_SIZE, sort: 'matchDate,desc', resultStatus: 'NONE', ...(sectionId ? { sectionId } : {}), ...(search ? { search } : {}) })
        matches.push(...result.content)
        const oldest = result.content[result.content.length - 1]
        if (result.content.length === 0 || page + 1 >= result.totalPages || (oldest && new Date(oldest.matchDate).getTime() < span.from)) break
      }
      return matches
    },
    enabled: open,
  })

  const sections = sectionsQuery.data ?? []
  const sectionOfTeam = (teamId: string | null) => {
    const team = teamId ? teamsQuery.data?.find((item) => item.id === teamId) : undefined
    return team ? sectionPath(sections, team.sectionId) : ''
  }

  const inWindow = (query.data ?? []).filter((match) => {
    const time = new Date(match.matchDate).getTime()
    return time >= span.from && time <= span.to && (match.resultStatus ?? 'NONE') === 'NONE'
  })
  const fresh = inWindow.filter((match) => !listedIds.includes(match.id))
  const shown = fresh.slice(0, MAX_ROWS)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, alignItems: 'stretch' }}>
      <MuiButton
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="find-another-match"
        variant="text"
        endIcon={<ExpandMoreIcon sx={{ transform: open ? 'rotate(180deg)' : 'none' }} />}
        sx={{ alignSelf: 'flex-start', minHeight: 44, textTransform: 'none', fontWeight: 600, color: 'info.main' }}
      >
        Find another match
      </MuiButton>
      <Collapse in={open} unmountOnExit>
        <Box id="find-another-match" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <SectionTreeSelect label="Section" sections={sections} value={sectionId} onChange={setSectionId} allowClear />
          <TextField label="Team name (optional)" value={text} onChange={(event) => setText(event.target.value)} fullWidth />
          {query.isError && (
            <Typography variant="body2" color="error" role="alert">
              Couldn&apos;t load the matches. Please try again.
            </Typography>
          )}
          {query.isPending && (
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          )}
          {query.isSuccess && shown.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No recent matches without a result. Try another section or add the match.
            </Typography>
          )}
          {shown.length > 0 && (
            <TileChoiceGroup<string>
              label="Found by search"
              value={null}
              onChange={(id) => {
                const match = shown.find((item) => item.id === id)
                if (match) onFound(match)
              }}
              columns="1fr"
              disabled={disabled}
              tileSx={{ alignItems: 'flex-start', textAlign: 'left', gap: 1.5, py: 1.5, px: { xs: 1.5, md: 2 }, display: 'flex' }}
              options={shown.map((match) => {
                const published = match.resultStatus === 'PUBLISHED'
                const ours = Boolean(match.homeTeamId || match.awayTeamId)
                return {
                  value: match.id,
                  disabled: published,
                  content: (
                    <>
                      {published ? (
                        <BlockOutlinedIcon role="img" aria-label="Not available" sx={{ flex: 'none', mt: 0.25, color: 'text.secondary' }} />
                      ) : (
                        <RadioButtonUncheckedIcon role="img" aria-label="Not selected" sx={{ flex: 'none', mt: 0.25, color: 'text.secondary' }} />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', columnGap: 1.5, rowGap: 0.25, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <Typography component="span" sx={{ fontSize: '0.9375rem', fontWeight: 700, overflowWrap: 'anywhere' }}>
                            {match.homeTeamName} v {match.awayTeamName}
                          </Typography>
                          <Typography component="span" variant="body2" color="text.secondary">
                            {[formatMatchDateTime(match.matchDate), leaguesQuery.data?.find((league) => league.id === match.leagueId)?.name, sectionOfTeam(match.homeTeamId ?? match.awayTeamId)].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                          <Chip size="small" label="Found by search" sx={{ ...badgeSx('muted'), height: 24, fontSize: '0.75rem' }} />
                          {published && <Chip size="small" label="Published. Unpublish it first" sx={{ ...badgeSx('muted'), height: 24, fontSize: '0.75rem' }} />}
                          {!published && !ours && <Chip size="small" label="Neither team is yours. Edit the match first" sx={{ ...badgeSx('warning'), height: 24, fontSize: '0.75rem' }} />}
                        </Box>
                      </Box>
                    </>
                  ),
                }
              })}
            />
          )}
          {fresh.length > MAX_ROWS && (
            <Typography variant="body2" color="text.secondary">
              Showing the newest {MAX_ROWS} of {fresh.length}. Narrow by section or team name to see the rest.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}
