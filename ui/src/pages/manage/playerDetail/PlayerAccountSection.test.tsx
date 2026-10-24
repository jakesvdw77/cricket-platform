import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { PlayerLink } from '../../../api/playerAccountsApi'
import { PlayerAccountSection } from './PlayerAccountSection'
import { httpError, renderWithProviders, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const http = api as unknown as ApiMock
const LINKS = '/manage/clubs/c1/players/p1/links'
const link = (overrides: Partial<PlayerLink>): PlayerLink => ({
  linkId: 'l1',
  agentName: 'Priya Naidoo',
  maskedEmail: 'p***@example.com',
  main: true,
  status: 'ACTIVE',
  grantedVia: 'EMAIL_MATCH',
  since: '2026-01-01',
  ...overrides,
})

const renderSection = () => renderWithProviders(<PlayerAccountSection clubId="c1" playerId="p1" playerName="Aman Naidoo" />)

describe('PlayerAccountSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the main agent by name and masked email, and how many other agents there are', async () => {
    routeApi(http, { [`GET ${LINKS}`]: [link({}), link({ linkId: 'l2', agentName: 'Second', main: false }), link({ linkId: 'l3', agentName: 'Third', main: false })] })
    renderSection()

    expect(await screen.findByText('Priya Naidoo (p***@example.com)')).toBeInTheDocument()
    expect(screen.getByText('Other agents')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByTestId('player-agent-actions')).toBeInTheDocument()
  })

  it('shows No main agent when nobody is the main agent', async () => {
    routeApi(http, { [`GET ${LINKS}`]: [] })
    renderSection()

    expect(await screen.findAllByText('No main agent')).not.toHaveLength(0)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('hides the card on a failed read rather than showing a wrong No main agent', async () => {
    routeApi(http, { [`GET ${LINKS}`]: httpError(403) })
    renderSection()

    await vi.waitFor(() => expect(http.get).toHaveBeenCalled())
    await vi.waitFor(() => expect(screen.queryByTestId('player-account-section')).not.toBeInTheDocument())
    expect(screen.queryByText('No main agent')).not.toBeInTheDocument()
  })
})
