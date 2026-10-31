import { describe, expect, it } from 'vitest'
import { LEAGUE_SCHEDULE_IMPORT_TYPE } from '../../../utils/leagueScheduleImport'
import { useLeagueScheduleWizardProps } from '../leagueImport/useLeagueScheduleWizardProps'
import { IMPORT_CONSUMERS } from './importConsumers'

describe('IMPORT_CONSUMERS', () => {
  it('registers the league schedule consumer with its wizard-props hook', () => {
    expect(IMPORT_CONSUMERS[LEAGUE_SCHEDULE_IMPORT_TYPE].useWizardProps).toBe(useLeagueScheduleWizardProps)
  })

  it('has no entry for an unknown type, so the generic wizard is used', () => {
    expect(IMPORT_CONSUMERS['SOMETHING_ELSE']).toBeUndefined()
  })
})
