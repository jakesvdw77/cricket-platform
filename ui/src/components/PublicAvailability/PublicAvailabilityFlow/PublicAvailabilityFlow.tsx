import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { pageBackgroundGradient } from '../../../theme'
import { useRememberedPlayers } from '../../../hooks/useRememberedPlayers'
import type { RememberedPlayerView } from '../../../hooks/useRememberedPlayers'
import { httpStatusOf, readProblem } from '../../../api/publicAvailabilityShared'
import type { PickCandidate, PublicAnswer, PublicAnswers, VerifiedResponse } from '../../../api/publicAvailabilityShared'
import { initialsOf } from '../../../utils/publicAvailabilityFormat'
import { AnswerForm } from '../AnswerForm'
import type { AnswerMap } from '../AnswerForm'
import { IdentifyForm } from '../IdentifyForm'
import type { IdentifyValues } from '../IdentifyForm'
import { PickPlayer } from '../PickPlayer'
import { PublicPollHeader } from '../PublicPollHeader'
import { RememberedPlayers } from '../RememberedPlayers'
import { SavedSummary } from '../SavedSummary'
import type { PublicPollAdapter, PublicPollContext } from './adapters'

export interface PublicAvailabilityFlowProps {
  // The poll id or round id from the route.
  id: string
  adapter: PublicPollAdapter
}

type Stage = 'identify' | 'pick' | 'answer' | 'saved'

type Problem =
  | { kind: 'failed'; triesLeft?: number }
  | { kind: 'locked'; retryAfterSeconds?: number }
  | { kind: 'noDateOfBirth' }
  | { kind: 'error' }

interface Session {
  playerId: string
  firstName: string
  lastName: string
  token: string
  expiresAt: string
}

interface VerifyOutcome {
  response: Awaited<ReturnType<PublicPollAdapter['verify']>>
  answers?: PublicAnswers
}

const EXPIRED_NOTICE = 'Your 30 minutes ran out, enter your details again. Your chosen answers are kept.'
const CLOSED_TEXT = 'This poll has closed, so answers can no longer be changed. Please contact your manager.'

function toAnswerMap(answers: PublicAnswer[], ctx: PublicPollContext): AnswerMap {
  const map: AnswerMap = {}
  for (const answer of answers) {
    const slot = ctx.slots.find((candidate) => candidate.windowId === answer.windowId)
    if (slot) map[slot.key] = answer.status
  }
  return map
}

function toPayload(map: AnswerMap, ctx: PublicPollContext): PublicAnswer[] {
  return ctx.slots.flatMap((slot) => {
    const status = map[slot.key]
    return slot.open && status ? [{ windowId: slot.windowId, status }] : []
  })
}

function BrandStrip({ name }: { name: string }) {
  return (
    <Box
      component="header"
      sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5 }}
    >
      <Box
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          bgcolor: 'background.paper',
          color: 'primary.dark',
          display: 'grid',
          placeItems: 'center',
          fontSize: '0.65rem',
          fontWeight: 700,
        }}
      >
        {initialsOf(name)}
      </Box>
      <Typography component="span" variant="subtitle2" sx={{ fontWeight: 700 }}>
        {name}
      </Typography>
    </Box>
  )
}

function Shell({ brandName, children }: { brandName: string; children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandStrip name={brandName} />
      <Box component="main" sx={{ flex: 1, background: (theme) => pageBackgroundGradient(theme), px: { xs: 0, sm: 2 }, py: { xs: 0, sm: 4 } }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 480,
            mx: 'auto',
            p: { xs: 2, sm: 3 },
            bgcolor: { xs: 'transparent', sm: 'background.paper' },
            borderRadius: { sm: 2 },
            boxShadow: { sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}

function StateMessage({ symbol, title, text }: { symbol: string; title: string; text: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0.75, py: 3 }}>
      <Typography aria-hidden sx={{ fontSize: '2rem', color: 'text.secondary' }}>
        {symbol}
      </Typography>
      <Typography variant="h6" component="h1" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Box>
  )
}

// docs/specs/077: the whole public availability journey, shared by the squad poll and the group
// poll through a small adapter. identify -> (pick) -> answer (prefilled when answers exist) ->
// saved. The 30 minute token lives in React state only; names (never the date of birth, token or
// id) are remembered on this device after a successful save.
export function PublicAvailabilityFlow({ id, adapter }: PublicAvailabilityFlowProps) {
  const query = useQuery({
    queryKey: adapter.queryKey(id),
    queryFn: () => adapter.load(id),
    retry: false,
  })
  const ctx = query.data

  const remembered = useRememberedPlayers(ctx?.clubId, id)

  const [stage, setStage] = useState<Stage>('identify')
  const [mode, setMode] = useState<'welcome' | 'form'>('welcome')
  const [prefill, setPrefill] = useState<{ firstName: string; lastName: string; locked: boolean } | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pick, setPick] = useState<{ details: IdentifyValues; candidates: PickCandidate[] } | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [hasExisting, setHasExisting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [closedWhileSaving, setClosedWhileSaving] = useState(false)
  // Answers chosen before the token ran out, restored if the same player verifies again.
  const pending = useRef<{ playerId: string; answers: AnswerMap } | null>(null)

  const verifyMutation = useMutation<VerifyOutcome, unknown, { details: IdentifyValues; playerId?: string }>({
    mutationFn: async ({ details, playerId }) => {
      const response = await adapter.verify(id, { ...details, ...(playerId ? { playerId } : {}) })
      if (response.status === 'VERIFIED') {
        return { response, answers: await adapter.getAnswers(id, response.playerId, response.token) }
      }
      return { response }
    },
  })

  const saveMutation = useMutation<PublicAnswers, unknown, { session: Session; payload: PublicAnswer[] }>({
    mutationFn: ({ session: current, payload }) => adapter.putAnswers(id, current.playerId, current.token, payload),
  })

  function resetToIdentify(options: { form: boolean; keepProblem?: boolean }) {
    setStage('identify')
    setSession(null)
    setPick(null)
    setAnswers({})
    setHasExisting(false)
    setSaveError(null)
    setPrefill(null)
    setNotice(null)
    if (!options.keepProblem) setProblem(null)
    setMode(options.form ? 'form' : 'welcome')
    setFormKey((key) => key + 1)
    pending.current = null
  }

  function sessionExpired(current: Session) {
    pending.current = { playerId: current.playerId, answers }
    setStage('identify')
    setSession(null)
    setProblem(null)
    setMode('form')
    setPrefill({ firstName: current.firstName, lastName: current.lastName, locked: true })
    setNotice(EXPIRED_NOTICE)
    setFormKey((key) => key + 1)
  }

  function enterAnswerStage(verified: VerifiedResponse, existing: PublicAnswers | undefined, context: PublicPollContext) {
    const fromServer = toAnswerMap(existing?.answers ?? [], context)
    const kept = pending.current?.playerId === verified.playerId ? pending.current.answers : null
    pending.current = null
    setSession({
      playerId: verified.playerId,
      firstName: verified.firstName,
      lastName: verified.lastName,
      token: verified.token,
      expiresAt: verified.expiresAt,
    })
    setAnswers(kept ?? fromServer)
    setHasExisting(Object.keys(fromServer).length > 0)
    setSaveError(null)
    setProblem(null)
    setNotice(null)
    setPick(null)
    setStage('answer')
  }

  async function runVerify(details: IdentifyValues, playerId?: string) {
    if (!ctx) return
    setProblem(null)
    setNotice(null)
    try {
      const { response, answers: existing } = await verifyMutation.mutateAsync({ details, playerId })
      if (response.status === 'VERIFIED') {
        enterAnswerStage(response, existing, ctx)
      } else if (response.status === 'PICK') {
        setPick({ details, candidates: response.candidates })
        setStage('pick')
      } else {
        setProblem({ kind: 'noDateOfBirth' })
        setStage('identify')
      }
    } catch (error) {
      const info = readProblem(error)
      setStage('identify')
      setPick(null)
      if (info.status === 423 || info.status === 429) {
        setProblem({ kind: 'locked', retryAfterSeconds: info.retryAfterSeconds })
      } else if (info.status === 403) {
        setProblem(info.triesLeft === 0 ? { kind: 'locked' } : { kind: 'failed', triesLeft: info.triesLeft })
      } else {
        setProblem({ kind: 'error' })
      }
      setFormKey((key) => key + 1)
      setPrefill({ firstName: details.firstName, lastName: details.lastName, locked: prefill?.locked ?? false })
      setMode('form')
    }
  }

  async function save() {
    if (!session || !ctx) return
    setSaveError(null)
    try {
      const saved = await saveMutation.mutateAsync({ session, payload: toPayload(answers, ctx) })
      remembered.remember(session.firstName, session.lastName)
      setAnswers(toAnswerMap(saved.answers, ctx))
      setStage('saved')
    } catch (error) {
      const status = httpStatusOf(error)
      if (status === 401) {
        sessionExpired(session)
      } else if (status === 409) {
        setClosedWhileSaving(true)
        setSaveError(CLOSED_TEXT)
        void query.refetch()
      } else {
        setSaveError('Something went wrong saving your answer. Please try again.')
      }
    }
  }

  function changeAnswer() {
    if (session && Date.parse(session.expiresAt) <= Date.now()) {
      sessionExpired(session)
      return
    }
    setSaveError(null)
    setStage('answer')
  }

  function selectRemembered(player: RememberedPlayerView) {
    setProblem(null)
    setPrefill({ firstName: player.firstName, lastName: player.lastName, locked: true })
    setMode('form')
    setFormKey((key) => key + 1)
  }

  const notFound = httpStatusOf(query.error) === 404
  const brandName = ctx?.brandName ?? 'Availability'

  if (query.isLoading) {
    return (
      <Shell brandName={brandName}>
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      </Shell>
    )
  }

  if (!ctx) {
    return (
      <Shell brandName={brandName}>
        {notFound ? (
          <StateMessage symbol="?" title="Poll not found" text="This availability link is not valid, or the poll no longer exists." />
        ) : (
          <StateMessage symbol="!" title="Couldn't load this poll" text="Something went wrong loading this poll. Please try again." />
        )}
      </Shell>
    )
  }

  const header = (
    <PublicPollHeader
      open={ctx.open}
      title={ctx.title}
      subtitle={ctx.subtitle}
      details={ctx.details}
      scheduledCloseAt={ctx.scheduledCloseAt}
    />
  )

  if (!ctx.open) {
    return (
      <Shell brandName={brandName}>
        {header}
        <Alert severity="info">{CLOSED_TEXT}</Alert>
      </Shell>
    )
  }

  const submitting = verifyMutation.isPending
  const showWelcome = stage === 'identify' && mode === 'welcome' && remembered.players.length > 0 && !problem
  const lockedState = problem?.kind === 'locked' ? { retryAfterSeconds: problem.retryAfterSeconds ?? null } : null

  return (
    <Shell brandName={brandName}>
      {closedWhileSaving && <Alert severity="info">{CLOSED_TEXT}</Alert>}
      {header}

      {showWelcome && (
        <RememberedPlayers
          players={remembered.players}
          onSelect={selectRemembered}
          onRemove={remembered.remove}
          onForgetAll={remembered.forgetAll}
          onSomeoneElse={() => {
            setPrefill(null)
            setMode('form')
            setFormKey((key) => key + 1)
          }}
        />
      )}

      {stage === 'identify' && !showWelcome && (
        <IdentifyForm
          key={formKey}
          onSubmit={(details) => void runVerify(details)}
          submitting={submitting}
          initialFirstName={prefill?.firstName}
          initialLastName={prefill?.lastName}
          nameLocked={prefill?.locked ?? false}
          onNotYou={() => resetToIdentify({ form: remembered.players.length === 0 })}
          failed={problem?.kind === 'failed'}
          triesLeft={problem?.kind === 'failed' ? problem.triesLeft : undefined}
          errorMessage={problem?.kind === 'error' ? 'Something went wrong checking your details. Please try again.' : null}
          notice={notice}
          locked={lockedState}
          noDateOfBirth={problem?.kind === 'noDateOfBirth'}
          onTryAgain={() => resetToIdentify({ form: true })}
        />
      )}

      {stage === 'pick' && pick && (
        <PickPlayer
          firstName={pick.details.firstName}
          lastName={pick.details.lastName}
          candidates={pick.candidates}
          disabled={submitting}
          onPick={(playerId) => void runVerify(pick.details, playerId)}
          onBack={() => resetToIdentify({ form: true })}
        />
      )}

      {stage === 'answer' && session && (
        <AnswerForm
          playerName={`${session.firstName} ${session.lastName}`}
          slots={ctx.slots}
          answers={answers}
          onChange={setAnswers}
          onSave={() => void save()}
          onNotYou={() => resetToIdentify({ form: remembered.players.length === 0 })}
          saving={saveMutation.isPending}
          errorMessage={saveError}
          hasExisting={hasExisting}
        />
      )}

      {stage === 'saved' && session && (
        <SavedSummary
          firstName={session.firstName}
          entries={ctx.slots.flatMap((slot) => {
            const status = answers[slot.key]
            return status ? [{ label: slot.label ?? 'Your answer', status }] : []
          })}
          onChangeAnswer={changeAnswer}
          onSomeoneElse={() => resetToIdentify({ form: true })}
        />
      )}
    </Shell>
  )
}
