import type { MyMatchStreamDto, MyStreamProvider } from '../../../api/myPlayersApi'
import { isHttps } from './leagueFormat'

// docs/specs/135 (Watch Live): what the stream frame is allowed to be. The embed URL is built only by the server from an allow-listed
// template; this never builds, rewrites or "improves" a URL, it only passes the server's `embedUrl` on, and only when it is https.
export const FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-presentation'
export const FRAME_ALLOW = 'autoplay; fullscreen; picture-in-picture'
export const FRAME_REFERRER_POLICY = 'strict-origin-when-cross-origin'

export interface StreamFrameProps {
  src: string
  title: string
  sandbox: string
  allow: string
  referrerPolicy: 'strict-origin-when-cross-origin'
  loading: 'lazy'
}

// Null when there is nothing safe to embed (no embedUrl, or one that is not https): the page then offers Open Stream only.
export function streamFrame(stream: Pick<MyMatchStreamDto, 'embedUrl'>, title: string): StreamFrameProps | null {
  const src = stream.embedUrl
  if (!isHttps(src)) return null
  return { src, title, sandbox: FRAME_SANDBOX, allow: FRAME_ALLOW, referrerPolicy: FRAME_REFERRER_POLICY, loading: 'lazy' }
}

const PROVIDERS: Record<MyStreamProvider, string> = { YOUTUBE: 'YouTube', VIMEO: 'Vimeo', FACEBOOK: 'Facebook', OTHER: 'The stream site' }
export const providerName = (provider: MyStreamProvider): string => PROVIDERS[provider] ?? PROVIDERS.OTHER

// The host of a stream link, for "This stream opens on {host}" only; empty when the link does not parse.
export function streamHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
