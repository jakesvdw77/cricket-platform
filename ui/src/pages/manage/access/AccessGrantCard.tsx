import { RecordCard } from '../../../components/RecordCard'
import type { RecordCardBadge } from '../../../components/RecordCard'
import type { AccessGrant } from '../../../api/accessGrantsApi'
import { initialsFromName } from '../../../utils/initials'
import { AccessGrantRowMenu } from './AccessGrantRowMenu'
import type { AccessGrantRowMenuProps } from './AccessGrantRowMenu'
import { fullName, placeLabel, statusLabel } from './accessGrantFormat'

export function grantBadges(grant: AccessGrant): RecordCardBadge[] {
  return [
    { label: grant.roleName, tone: 'active' },
    { label: placeLabel(grant), tone: 'neutral' },
    { label: statusLabel(grant), tone: grant.status === 'INVITED' ? 'warning' : 'positive' },
  ]
}

// docs/specs/150 and page-anatomy section 4 and 6: one flat RecordCard per person at one place, the badges under the title, ONE
// kebab in the corner and no footer bar. A person has no page of their own, so the name is plain text (the rule allows it
// where the record has no page).
export function AccessGrantCard(props: Omit<AccessGrantRowMenuProps, 'testId'>) {
  const { grant } = props
  const name = fullName(grant)
  return (
    <RecordCard
      flat
      title={name}
      titleWrap
      badgesBelow
      avatar={{ fallback: initialsFromName(name), shape: 'circular' }}
      description={grant.email}
      badges={grantBadges(grant)}
      headerActions={<AccessGrantRowMenu {...props} testId="access-card-actions" />}
      fields={[
        ...(grant.addedByName ? [{ label: 'Added by', value: grant.addedByName }] : []),
        ...(grant.self ? [{ label: 'Access', value: 'Your own access' }] : []),
      ]}
      footerActions={null}
    />
  )
}
