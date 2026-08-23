import api from './axiosConfig'

// POST /api/v1/platform/media's response shape — the public /media/** path to hand back into
// ClubProfilePayload's logoUrl/bannerUrl on a subsequent profile save. Not scoped to
// ClubProfile — any future consumer (Sponsors, Club Contacts) calls the same endpoint, per
// docs/specs/012-club-profile.md's reusability goal.
export interface MediaUploadResponse {
  url: string
}

// Generic image upload — multipart `file` field, MIME-type restricted server-side to a fixed
// image allowlist (PNG/JPEG/WebP). MediaUpload (ui/src/components/MediaUpload) is this
// function's first consumer but not its only intended one.
export async function uploadMedia(file: File): Promise<MediaUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await api.post<MediaUploadResponse>('/platform/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// Same upload, reachable by any authenticated /manage caller (a CLUB_ADMIN can't reach
// /platform/**, per docs/specs/021-club-contacts.md's Media architecture note) — no @PreAuthorize
// server-side, since the upload itself isn't club-scoped data until its URL is attached to an
// authorized record (e.g. a ClubContact). MediaUpload's namespace="manage" prop selects this.
export async function uploadManagedMedia(file: File): Promise<MediaUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await api.post<MediaUploadResponse>('/manage/media', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
