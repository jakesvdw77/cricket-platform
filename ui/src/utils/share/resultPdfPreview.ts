import { PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH } from './resultPdf'
import type { PdfOp } from './resultPdf'

// docs/specs/114-share-result.md (Preview and delivery): the PDF preview. jsPDF cannot rasterise, so the page is drawn into
// a canvas from the SAME laid-out operations resultPdf.ts replays into the document (same positions, sizes, colours and
// text), which is why what is shown is what is made. No new dependency.

const FONT_STACK = 'Helvetica, Arial, "Liberation Sans", sans-serif'
const MM_PER_PT = 25.4 / 72
const PAPER = '#ffffff'

const rgb = (colour: [number, number, number]): string => `rgb(${colour[0]}, ${colour[1]}, ${colour[2]})`

function loadImage(data: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = data
  })
}

// Draws one page into the canvas, `pixelWidth` pixels across (A4 proportions). Throws when there is no 2D context.
export async function drawResultPdfPage(canvas: HTMLCanvasElement, ops: PdfOp[], pixelWidth = 840): Promise<void> {
  const scale = pixelWidth / PDF_PAGE_WIDTH
  const images = new Map<string, HTMLImageElement | null>()
  await Promise.all(
    [...new Set(ops.filter((op) => op.kind === 'image').map((op) => (op as Extract<PdfOp, { kind: 'image' }>).data))].map(
      async (data) => {
        images.set(data, await loadImage(data))
      },
    ),
  )
  canvas.width = Math.round(pixelWidth)
  canvas.height = Math.round(PDF_PAGE_HEIGHT * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No 2D canvas context')
  context.fillStyle = PAPER
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.textBaseline = 'alphabetic'

  for (const op of ops) {
    if (op.kind === 'rect') {
      context.fillStyle = rgb(op.fill)
      if (op.radius > 0) {
        const x = op.x * scale
        const y = op.y * scale
        const w = op.width * scale
        const h = op.height * scale
        const r = Math.min(op.radius * scale, w / 2, h / 2)
        context.beginPath()
        context.moveTo(x + r, y)
        context.arcTo(x + w, y, x + w, y + h, r)
        context.arcTo(x + w, y + h, x, y + h, r)
        context.arcTo(x, y + h, x, y, r)
        context.arcTo(x, y, x + w, y, r)
        context.closePath()
        context.fill()
      } else {
        context.fillRect(op.x * scale, op.y * scale, op.width * scale, op.height * scale)
      }
    } else if (op.kind === 'line') {
      // A hairline is a thin filled rectangle: it needs no path state.
      const thickness = Math.max(1, op.lineWidth * scale)
      context.fillStyle = rgb(op.colour)
      context.fillRect(op.x1 * scale, op.y1 * scale - thickness / 2, (op.x2 - op.x1) * scale, thickness)
    } else if (op.kind === 'text') {
      const weight = op.font === 'bold' ? 'bold ' : op.font === 'italic' ? 'italic ' : ''
      context.font = `${weight}${op.size * MM_PER_PT * scale}px ${FONT_STACK}`
      context.fillStyle = rgb(op.colour)
      context.textAlign = op.align
      context.fillText(op.text, op.x * scale, op.y * scale)
    } else {
      const image = images.get(op.data)
      if (image) context.drawImage(image, op.x * scale, op.y * scale, op.width * scale, op.height * scale)
    }
  }
}
