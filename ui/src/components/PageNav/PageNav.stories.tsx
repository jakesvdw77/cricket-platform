import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageNav } from './PageNav'

const meta: Meta<typeof PageNav> = {
  title: 'Components/PageNav',
  component: PageNav,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PageNav>

function Demo({ initial, totalPages }: { initial: number; totalPages: number }) {
  const [page, setPage] = useState(initial)
  return <PageNav page={page} totalPages={totalPages} onPageChange={setPage} />
}

export const FirstPage: Story = { render: () => <Demo initial={0} totalPages={5} /> }

export const LastPage: Story = { render: () => <Demo initial={4} totalPages={5} /> }
