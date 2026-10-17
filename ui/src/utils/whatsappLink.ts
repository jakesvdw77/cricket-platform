// The public WhatsApp "click to chat" link with the message filled in. A web page cannot pick the
// recipient or press send; the manager does that in WhatsApp. Links over roughly 2,000 characters
// are unreliable, so callers check `fitsWhatsAppLink` first (docs/specs/114-share-result.md).
export const WHATSAPP_LINK_MAX_CHARS = 1800

export function buildWhatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

// True when the URL-encoded message is within WHATSAPP_LINK_MAX_CHARS.
export function fitsWhatsAppLink(text: string): boolean {
  return encodeURIComponent(text).length <= WHATSAPP_LINK_MAX_CHARS
}
