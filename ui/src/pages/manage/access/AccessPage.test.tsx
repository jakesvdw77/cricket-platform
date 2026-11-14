import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccessPage from './AccessPage'
import type { AccessGrantList } from '../../../api/accessGrantsApi'
import { renderRoutes } from '../../../test/accountTestUtils'

const grants = vi.hoisted(() => ({ data: undefined as AccessGrantList | undefined }))

vi.mock('../../../api/accessGrantsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/accessGrantsApi')>()),
  useAccessGrants: () => ({ data: grants.data }),
  useAccessRoles: () => ({ data: [] }),
  useAddAccessGrant: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
}))
vi.mock('../../../api/sectionApi', () => ({ listSections: vi.fn(async () => []) }))

// docs/specs/119 Part 3 and docs/specs/150: Access has three tabs, the tab lives in the URL, and Add New Person shows only when the server says so.
const routes = (
  <Route path="/manage/permissions" element={<AccessPage />}>
    <Route index element={<div>People content</div>} />
    <Route path="roles" element={<div>Roles content</div>} />
    <Route path="player-accounts" element={<div>Player accounts content</div>} />
  </Route>
)

const list = (canManage: boolean): AccessGrantList => ({
  items: [],
  clubWideCount: 0,
  canManage,
  canGrantClubWide: canManage,
  grantableSectionIds: [],
  roles: [],
})

describe('AccessPage', () => {
  beforeEach(() => {
    grants.data = list(true)
  })

  it('shows the Access title and three tabs, People selected on the base URL', () => {
    renderRoutes('/manage/permissions', routes)

    expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument()
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['People', 'Roles', 'Player accounts'])
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('People content')).toBeInTheDocument()
  })

  it('a refresh on the Roles URL keeps that tab selected', () => {
    renderRoutes('/manage/permissions/roles', routes)

    expect(screen.getByRole('link', { name: 'Roles' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'People' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Roles content')).toBeInTheDocument()
  })

  it('a refresh on the Player accounts URL keeps that tab selected', () => {
    renderRoutes('/manage/permissions/player-accounts', routes)

    expect(screen.getByRole('link', { name: 'Player accounts' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'People' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Player accounts content')).toBeInTheDocument()
  })

  it('switches tabs by following the links, which are real URLs', async () => {
    renderRoutes('/manage/permissions', routes)

    expect(screen.getByRole('link', { name: 'Roles' })).toHaveAttribute('href', '/manage/permissions/roles')
    expect(screen.getByRole('link', { name: 'Player accounts' })).toHaveAttribute('href', '/manage/permissions/player-accounts')
    await userEvent.click(screen.getByRole('link', { name: 'Player accounts' }))

    expect(await screen.findByText('Player accounts content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Player accounts' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows Add New Person on the People tab when the server says the caller may give access', () => {
    renderRoutes('/manage/permissions', routes)

    expect(screen.getByRole('button', { name: 'Add New Person' })).toBeInTheDocument()
  })

  it('hides Add New Person for a caller who may not give access, and on the other tabs', () => {
    grants.data = list(false)
    renderRoutes('/manage/permissions', routes)
    expect(screen.queryByRole('button', { name: 'Add New Person' })).not.toBeInTheDocument()
  })

  it('does not show Add New Person on the Roles tab', () => {
    renderRoutes('/manage/permissions/roles', routes)

    expect(screen.queryByRole('button', { name: 'Add New Person' })).not.toBeInTheDocument()
  })
})
