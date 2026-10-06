import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { NavTile } from './NavTile'

describe('NavTile', () => {
  it('renders the title, description, and icon, and links to the given route', () => {
    render(
      <MemoryRouter>
        <NavTile title="Teams" description="Register teams" icon={<GroupsOutlinedIcon />} to="/manage/teams" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByText('Register teams')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/manage/teams')
  })

  it('renders a brand icon instead of the MUI tile when brandIcon is set', () => {
    const { container } = render(
      <MemoryRouter>
        <NavTile title="Teams" description="Register teams" brandIcon="nav/teams" to="/manage/teams" />
      </MemoryRouter>,
    )

    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toHaveStyle({ width: '40px', height: '40px' })
    expect(img).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).toBeNull()
  })
})
