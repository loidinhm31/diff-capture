import * as pdfjsLib from 'pdfjs-dist'

// Use local worker bundled with pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href

const SCALE = 2 // 2x DPI for rendering accuracy

export interface RenderedPage {
  pageNum: number
  canvas: HTMLCanvasElement
}

export async function renderPdfToCanvases(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<RenderedPage[]> {
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (err) {
    throw new Error(`Failed to read PDF file: ${err instanceof Error ? err.message : 'Unknown error'}`, { cause: err })
  }

  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  } catch (err) {
    throw new Error(`Failed to load PDF: ${err instanceof Error ? err.message : 'Invalid or corrupted PDF'}`, { cause: err })
  }

  const totalPages = pdf.numPages
  const results: RenderedPage[] = []

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: SCALE })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get 2D canvas context')

      await page.render({ canvasContext: ctx, canvas, viewport }).promise
      results.push({ pageNum: i, canvas })
    } catch (err) {
      throw new Error(`Failed to render page ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`, { cause: err })
    }
    onProgress?.(i, totalPages)
  }

  return results
}
