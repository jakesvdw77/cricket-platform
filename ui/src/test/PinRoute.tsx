import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

// For Storybook: .storybook/preview.tsx already wraps every story in a router, and a router cannot
// be nested inside another one, so a story that needs a particular active route moves the shared
// router there instead.
export function PinRoute({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace: true })
  }, [navigate, to])
  return <>{children}</>
}
