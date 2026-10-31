import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { backTarget } from '../utils/backTarget'
import { afterSaveTarget, RETURN_LABEL_PARAM, RETURN_TO_PARAM, safeReturnLabel, safeReturnTo } from '../utils/returnTo'

export interface ReturnTo {
  to: string
  label: string
}

// docs/specs/127-return-navigation.md: the validated origin of this page, or null. Reads the address first (survives a reload and
// a new tab), then the legacy router state { backTo, backLabel } through backTarget. A legacy `?from=` is page-specific and read by
// the page that still uses it.
export function useReturnTo(): ReturnTo | null {
  const [params] = useSearchParams()
  const location = useLocation()
  const to = safeReturnTo(params.get(RETURN_TO_PARAM))
  if (to) return { to, label: safeReturnLabel(params.get(RETURN_LABEL_PARAM)) ?? '' }
  const legacy = backTarget(location.state, { to: '', label: '' })
  return legacy.to ? legacy : null
}

// The Back link of a page: a valid origin overrides the page's own default, otherwise the default is returned unchanged.
// `defaultLabel` is the full default text ("Back to Matches"); an origin reads "Back to {label}", or "Back" without a label.
export function useBackLink(defaultTo: string | undefined, defaultLabel: string): { to: string | undefined; label: string } {
  const origin = useReturnTo()
  if (!origin) return { to: defaultTo, label: defaultLabel }
  return { to: origin.to, label: origin.label ? `Back to ${origin.label}` : 'Back' }
}

export interface AfterSaveOptions {
  state?: unknown
  showAll?: boolean
}

// Returns a function that navigates to the origin when there is one, else to the page's own default.
export function useAfterSave(defaultTo: string): (options?: AfterSaveOptions) => void {
  const navigate = useNavigate()
  const originTo = useReturnTo()?.to ?? null
  return useCallback(
    (options?: AfterSaveOptions) => {
      const target = afterSaveTarget(originTo ? { to: originTo } : null, { defaultTo, showAll: options?.showAll })
      navigate(target, options?.state === undefined ? undefined : { state: options.state })
    },
    [navigate, originTo, defaultTo],
  )
}
