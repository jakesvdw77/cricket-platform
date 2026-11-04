import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AddPollAction } from './AddPollAction'

describe('AddPollAction', () => {
  it('is a Create New Poll link that opens the poll type chooser', async () => {
    render(
      <MemoryRouter>
        <AddPollAction />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create New Poll' }))
    expect(await screen.findByRole('dialog', { name: 'Create New Poll' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Squad Poll/ })).toBeInTheDocument()
  })
})
