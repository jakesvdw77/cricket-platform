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
})
