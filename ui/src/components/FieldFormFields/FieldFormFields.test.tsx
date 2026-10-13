import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldFormFields } from './FieldFormFields'
import type { FieldFormFieldsProps } from './FieldFormFields'
import { emptyFieldForm } from '../../utils/fieldForm'
import type { FieldFormValues } from '../../utils/fieldForm'
import { fieldPage, makeField } from '../../test/fieldFixtures'

const findSimilarPlayingAreas = vi.fn()
const getPlayingArea = vi.fn()

vi.mock('../../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/playingAreaApi')>()
  return {
    ...actual,
    findSimilarPlayingAreas: (clubId: string, params: unknown) => findSimilarPlayingAreas(clubId, params),
    getPlayingArea: (clubId: string, id: string) => getPlayingArea(clubId, id),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  findSimilarPlayingAreas.mockResolvedValue([])
})

function Harness({ initial, onValues, ...props }: { initial?: Partial<FieldFormValues>; onValues?: (v: FieldFormValues) => void } & Partial<FieldFormFieldsProps>) {
  const [values, setValues] = useState<FieldFormValues>({ ...emptyFieldForm('ZA'), ...initial })
  onValues?.(values)
  return <FieldFormFields values={values} onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))} {...props} />
}

function renderFields(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

const SIMILAR = makeField({ id: 'field-9', name: 'Riverside Oval Ground', verificationStatus: 'UNVERIFIED' })

// docs/specs/099-fields-directory.md
describe('FieldFormFields', () => {
  describe('the add-field dialog body', () => {
    it('asks for name, type, owner, address (city and country at minimum) and an optional map link only', () => {
      renderFields({ variant: 'dialog' })

      for (const label of ['Name', 'Owner', 'City', 'Country', 'Street (optional)', 'Province (optional)', 'Map link (optional)']) {
        expect(screen.getByLabelText(label)).toBeInTheDocument()
      }
      expect(screen.getByRole('group', { name: 'Type' })).toBeInTheDocument()
      expect(screen.queryByLabelText('Owner type')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Postal code/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Location notes/)).not.toBeInTheDocument()
    })

    it('never shows an area type or a ground control or word', () => {
      const { container } = renderFields({ variant: 'dialog' })
      expect(container.textContent).not.toMatch(/area type|playing area|ground/i)
    })

    it('offers the five types', () => {
      renderFields({ variant: 'dialog' })
      const type = screen.getByRole('group', { name: 'Type' })
      expect(within(type).getAllByRole('button').map((b) => b.textContent)).toEqual(['School', 'Club', 'Academy', 'Municipal', 'Provincial'])
    })
  })

  describe('the page body', () => {
    it('has the three sections, owner type, postal code and location notes', () => {
      renderFields({ variant: 'page' })

      for (const heading of ['Basic info', 'Address', 'Map and notes']) expect(screen.getByText(heading)).toBeInTheDocument()
      expect(screen.getByLabelText('Owner type')).toBeInTheDocument()
      expect(screen.getByLabelText('Postal code (optional)')).toBeInTheDocument()
      expect(screen.getByLabelText('Location notes (optional)')).toBeInTheDocument()
      expect(screen.getByText('The owner of the land, even if your club only manages it')).toBeInTheDocument()
    })

    it('never shows an area type or ground control on the page either', () => {
      const { container } = renderFields({ variant: 'page' })
      expect(container.textContent).not.toMatch(/area type|playing area|ground/i)
    })

    it('shows the street as optional and City and Country as required', () => {
      renderFields({ variant: 'page' })
      expect(screen.getByLabelText('Street (optional)')).toBeInTheDocument()
      expect(screen.getByLabelText('City')).toBeInTheDocument()
      expect(screen.getByLabelText('Country')).toBeInTheDocument()
      expect(screen.queryByLabelText('City (optional)')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Country (optional)')).not.toBeInTheDocument()
    })

    it('shows the errors it is given under the fields', () => {
      renderFields({ errors: { name: 'Name is required', ownerName: 'Owner is required', city: 'City is required', country: 'Country is required', mapUrl: 'Use a link that starts with https://' } })
      for (const message of ['Name is required', 'Owner is required', 'City is required', 'Country is required', 'Use a link that starts with https://']) {
        expect(screen.getByText(message)).toBeInTheDocument()
      }
      expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    })

    it('reports typing and a chosen type as patches', async () => {
      const user = userEvent.setup()
      let latest: FieldFormValues | undefined
      renderFields({ onValues: (v) => (latest = v) })

      await user.type(screen.getByLabelText('Name'), 'Hilton Oval')
      await user.click(screen.getByRole('button', { name: 'School' }))

      expect(latest?.name).toBe('Hilton Oval')
      expect(latest?.category).toBe('SCHOOL')
    })

    it('shows the Country by name, chosen from a list of countries', async () => {
      const user = userEvent.setup()
      let latest: FieldFormValues | undefined
      renderFields({ onValues: (v) => (latest = v) })

      expect(screen.getByLabelText('Country')).toHaveTextContent('South Africa')
      await user.click(screen.getByLabelText('Country'))
      await user.click(await screen.findByRole('option', { name: 'India' }))

      expect(latest?.address.country).toBe('IN')
    })

    it('disables everything when read-only', () => {
      renderFields({ disabled: true })
      expect(screen.getByLabelText('Name')).toBeDisabled()
      expect(screen.getByLabelText('City')).toBeDisabled()
    })
  })

  describe('the Province label follows the Country', () => {
    it.each([
      ['ZA', 'Province (optional)'],
      ['GB', 'County (optional)'],
      ['IE', 'County (optional)'],
      ['US', 'State (optional)'],
      ['AU', 'State (optional)'],
      ['IN', 'State (optional)'],
      ['NZ', 'Province/County/State (optional)'],
    ])('%s labels it %s', (country, label) => {
      renderFields({ initial: { address: { ...emptyFieldForm(country).address } } })
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    })
  })

  describe('Did you mean', () => {
    const typeFieldDetails = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText('Name'), 'Riverside Oval')
      await user.type(screen.getByLabelText('City'), 'Hilton')
    }

    it('looks up similar fields in the same country from the name and city, and offers each one', async () => {
      findSimilarPlayingAreas.mockResolvedValue([SIMILAR])
      const user = userEvent.setup()
      const onUseExisting = vi.fn()
      renderFields({ clubId: 'club-1', suggest: true, onUseExisting })

      await typeFieldDetails(user)

      const panel = await screen.findByRole('region', { name: 'Did you mean' }, { timeout: 3000 })
      expect(findSimilarPlayingAreas).toHaveBeenLastCalledWith('club-1', { name: 'Riverside Oval', city: 'Hilton', country: 'ZA' })
      expect(within(panel).getByText('Did you mean one of these?')).toBeInTheDocument()
      expect(within(panel).getByText(/already exist in South Africa/)).toBeInTheDocument()
      const suggestion = within(panel).getByTestId('field-suggestion')
      expect(suggestion).toHaveTextContent('Riverside Oval Ground')
      expect(suggestion).toHaveTextContent('Unverified')

      await user.click(within(suggestion).getByRole('button', { name: 'Use this field' }))
      expect(onUseExisting).toHaveBeenCalledWith(SIMILAR)
    })

    it('hides the suggestions when the manager says it is a different field', async () => {
      findSimilarPlayingAreas.mockResolvedValue([SIMILAR])
      const user = userEvent.setup()
      renderFields({ clubId: 'club-1', suggest: true })
      await typeFieldDetails(user)
      await screen.findByRole('region', { name: 'Did you mean' }, { timeout: 3000 })

      await user.click(screen.getByRole('button', { name: 'No, this is a different field' }))

      expect(screen.queryByRole('region', { name: 'Did you mean' })).not.toBeInTheDocument()
    })

    it('does not look up anything before there is a name of three letters and a city', async () => {
      const user = userEvent.setup()
      renderFields({ clubId: 'club-1', suggest: true })

      await user.type(screen.getByLabelText('Name'), 'Ri')
      await user.type(screen.getByLabelText('City'), 'Hilton')
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(findSimilarPlayingAreas).not.toHaveBeenCalled()
    })

    it('does not look up anything unless suggest is on (the edit form)', async () => {
      const user = userEvent.setup()
      renderFields({ clubId: 'club-1', suggest: false })
      await typeFieldDetails(user)
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(findSimilarPlayingAreas).not.toHaveBeenCalled()
    })
  })

  describe('a 409 duplicate', () => {
    it('offers the existing field the server named, with Use this field', async () => {
      getPlayingArea.mockResolvedValue(fieldPage([SIMILAR]).content[0])
      const user = userEvent.setup()
      const onUseExisting = vi.fn()
      renderFields({ clubId: 'club-1', duplicateOfId: 'field-9', onUseExisting })

      const panel = await screen.findByRole('region', { name: 'Did you mean' })
      expect(getPlayingArea).toHaveBeenCalledWith('club-1', 'field-9')
      expect(within(panel).getByText('This field already exists.')).toBeInTheDocument()
      await user.click(within(panel).getByRole('button', { name: 'Use this field' }))

      expect(onUseExisting).toHaveBeenCalledWith(SIMILAR)
      expect(within(panel).queryByRole('button', { name: 'No, this is a different field' })).not.toBeInTheDocument()
    })

    it('shows nothing when no duplicate is reported', async () => {
      renderFields({ clubId: 'club-1', duplicateOfId: null })
      await waitFor(() => expect(getPlayingArea).not.toHaveBeenCalled())
      expect(screen.queryByRole('region', { name: 'Did you mean' })).not.toBeInTheDocument()
    })
  })
})
