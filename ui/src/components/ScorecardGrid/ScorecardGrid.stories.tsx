import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Button } from '@mui/material'
import { GridNumberInput, ScorecardGrid } from './index'
import { HowOutSelect } from '../HowOutSelect'
import { useReorderableRows } from '../../hooks/useReorderableRows'
import type { DismissalType } from '../../api/matchResultApi'

interface Row {
  id: string
  name: string
  howOut: DismissalType | null
  runs: number | null
  balls: number | null
}

const meta: Meta<typeof ScorecardGrid<Row>> = {
  title: 'Components/ScorecardGrid',
  component: ScorecardGrid,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ScorecardGrid<Row>>

const INITIAL: Row[] = [
  { id: 'a', name: 'Thabo Naidoo', howOut: 'CAUGHT', runs: 42, balls: 51 },
  { id: 'b', name: 'Riaan Pienaar', howOut: 'RUN_OUT', runs: 18, balls: 22 },
  { id: 'c', name: 'Johan Botha', howOut: null, runs: null, balls: null },
  { id: 'd', name: 'Ben Smith', howOut: 'DID_NOT_BAT', runs: null, balls: null },
]

function Demo({ reorderable }: { reorderable: boolean }) {
  const [rows, setRows] = useState(INITIAL)
  const patch = (id: string, change: Partial<Row>) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)))
  const reorder = useReorderableRows({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => setRows((current) => ids.map((id) => current.find((row) => row.id === id) as Row)),
  })
  return (
    <Box sx={{ maxWidth: 960 }}>
      <ScorecardGrid<Row>
        ariaLabel="Batting card"
        rows={rows}
        getRowId={(row) => row.id}
        reorder={reorderable ? reorder : undefined}
        isRowMuted={(row) => row.howOut === 'DID_NOT_BAT'}
        columns={[
          {
            id: 'howOut',
            header: 'How out',
            render: (row) => <HowOutSelect value={row.howOut} onChange={(howOut) => patch(row.id, { howOut })} ariaLabel={`How out, ${row.name}`} />,
          },
          {
            id: 'runs',
            header: 'R',
            align: 'right',
            render: (row) => <GridNumberInput value={row.runs} onChange={(runs) => patch(row.id, { runs })} ariaLabel={`Runs, ${row.name}`} column="runs" />,
          },
          {
            id: 'balls',
            header: 'B',
            align: 'right',
            render: (row) => <GridNumberInput value={row.balls} onChange={(balls) => patch(row.id, { balls })} ariaLabel={`Balls, ${row.name}`} column="balls" />,
          },
        ]}
        renderPlayer={(row) => <Button size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>{row.name}</Button>}
        renderCard={(row) => (
          <Box>
            <Box sx={{ fontWeight: 600, mb: 1 }}>{row.name}</Box>
            <HowOutSelect fullWidth value={row.howOut} onChange={(howOut) => patch(row.id, { howOut })} ariaLabel={`How out, ${row.name}`} />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <GridNumberInput stepper value={row.runs} onChange={(runs) => patch(row.id, { runs })} ariaLabel={`Runs, ${row.name}`} column="runs" />
              <GridNumberInput stepper value={row.balls} onChange={(balls) => patch(row.id, { balls })} ariaLabel={`Balls, ${row.name}`} column="balls" />
            </Box>
          </Box>
        )}
        onPickPlayer={() => {}}
      />
    </Box>
  )
}

export const Desktop: Story = { render: () => <Demo reorderable /> }
export const WithoutReorder: Story = { render: () => <Demo reorderable={false} /> }
