import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { installFakeImportApi } from './importFakes'
import type { FakeImportOptions } from './importFakes'

// Storybook helper (docs/specs/097): a fresh query client plus the fake import routes, installed before the children first render
// so their queries never reach the network. The fake is removed again on unmount.
export function FakeImportApiProvider({ options, children }: { options?: FakeImportOptions; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  const [server] = useState(() => installFakeImportApi(options))
  useEffect(() => () => server.restore(), [server])
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
