// The backend's required player fields (CreatePlayerRequest): first name, last name and (docs/specs/077) date of birth,
// shared by PlayerForm and PlayerQuickForm so the two cannot drift apart.
export const MIN_DATE_OF_BIRTH = '1900-01-01'

export type PlayerBasicsErrors = Partial<Record<'firstName' | 'lastName' | 'dateOfBirth', string>>

export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function validatePlayerBasics(values: { firstName: string; lastName: string; dateOfBirth: string }): PlayerBasicsErrors {
  const errors: PlayerBasicsErrors = {}
  if (!values.firstName.trim()) errors.firstName = 'First name is required'
  if (!values.lastName.trim()) errors.lastName = 'Last name is required'
  if (!values.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required'
  } else if (values.dateOfBirth > todayIso()) {
    errors.dateOfBirth = 'Date of birth must not be in the future'
  } else if (values.dateOfBirth < MIN_DATE_OF_BIRTH) {
    errors.dateOfBirth = 'Date of birth must not be before 1900-01-01'
  }
  return errors
}
