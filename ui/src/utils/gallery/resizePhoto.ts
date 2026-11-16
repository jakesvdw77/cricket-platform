// docs/specs/157-photo-gallery.md: the browser makes the two sizes before upload, so a phone sends a few hundred kilobytes and its
// rotation (EXIF) is already applied when the picture is drawn. The original is never sent.

export const MEDIUM_SIDE = 1280
export const THUMB_SIDE = 320
const QUALITY = 0.82

// The size that fits `max` on its longest side, never larger than the original.
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

async function load(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    // 'from-image' is the default in current browsers; saying it keeps an older one from ignoring the rotation.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('The photo could not be read.'))
    image.src = url
  })
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) }
}

function toJpeg(source: CanvasImageSource, width: number, height: number, max: number): Promise<Blob> {
  const size = fitWithin(width, height, max)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('The photo could not be prepared.'))
  // A PNG with see-through parts would turn black as a JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(source, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The photo could not be prepared.'))), 'image/jpeg', QUALITY))
}

export async function resizePhoto(file: File): Promise<{ medium: Blob; thumb: Blob }> {
  const loaded = await load(file)
  try {
    const medium = await toJpeg(loaded.source, loaded.width, loaded.height, MEDIUM_SIDE)
    const thumb = await toJpeg(loaded.source, loaded.width, loaded.height, THUMB_SIDE)
    return { medium, thumb }
  } finally {
    loaded.close()
  }
}
