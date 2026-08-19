import type { ChangeEvent } from 'react'
import { Input } from '../Input'

// Shared between ClubForm (010-minimal-club-creation.md) and ClubPicker's create mode
// (011-inline-club-creation-in-subscription-form.md) — both needed the identical Name/Slug
// field pair and helper-text logic, extracted here per docs/standards/frontend.md's
// "two components sharing more than ~70% of markup/logic" rule.
export interface ClubNameSlugFieldsProps {
  name: string
  slug: string
  // Whether the admin has edited Slug directly — while false, the "Auto-filled from name" hint
  // shows instead of the format hint. This component only picks the right helper text from it;
  // the actual auto-derivation (see ../../utils/slug's deriveSlug) is the consumer's job, since
  // ClubForm and ClubPicker each thread it through their own differently-shaped state.
  slugTouched: boolean
  nameError?: string
  slugError?: string
  onNameChange: (name: string) => void
  onSlugChange: (slug: string) => void
}

export function ClubNameSlugFields({
  name,
  slug,
  slugTouched,
  nameError,
  slugError,
  onNameChange,
  onSlugChange,
}: ClubNameSlugFieldsProps) {
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)
  const handleSlugChange = (event: ChangeEvent<HTMLInputElement>) => onSlugChange(event.target.value)

  return (
    <>
      <Input
        label="Name"
        value={name}
        onChange={handleNameChange}
        error={Boolean(nameError)}
        helperText={nameError}
      />
      <Input
        label="Slug"
        value={slug}
        onChange={handleSlugChange}
        error={Boolean(slugError)}
        helperText={
          slugError ??
          (!slugTouched && slug
            ? 'Auto-filled from name — edit to override'
            : 'Lowercase letters, numbers, and hyphens, e.g. riverside-cc')
        }
      />
    </>
  )
}
