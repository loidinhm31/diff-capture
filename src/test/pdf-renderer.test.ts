import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RenderedPage } from '../utils/pdf-renderer'

// ---------------------------------------------------------------------------
// Minimal mock for pdfjs-dist
// ---------------------------------------------------------------------------
const mockRender = vi.fn(() => ({ promise: Promise.resolve() }))
const mockGetViewport = vi.fn(({ scale }: { scale: number }) => ({
  width: 800 * scale,
  height: 600 * scale,
}))
const mockGetPage = vi.fn(async () => ({
  getViewport: mockGetViewport,
  render: mockRender,
}))
const mockGetDocument = vi.fn(() => ({
  promise: Promise.resolve({
    numPages: 2,
    getPage: mockGetPage,
  }),
}))

vi.mock('pdfjs-dist', () => ({
  default: {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: mockGetDocument,
  },
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: mockGetDocument,
}))

// Stub HTMLCanvasElement.getContext so jsdom doesn't throw
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
  })),
  writable: true,
})

// ---------------------------------------------------------------------------

describe('pdf-renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Re-assign defaults after clearAllMocks
    mockRender.mockReturnValue({ promise: Promise.resolve() })
    mockGetViewport.mockImplementation(({ scale }: { scale: number }) => ({
      width: 800 * scale,
      height: 600 * scale,
    }))
    mockGetPage.mockImplementation(async () => ({
      getViewport: mockGetViewport,
      render: mockRender,
    }))
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: mockGetPage,
      }),
    })
  })

  it('returns one RenderedPage per PDF page', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    const file = new File(['%PDF-1.4 fake'], 'a.pdf', { type: 'application/pdf' })
    const pages: RenderedPage[] = await renderPdfToCanvases(file)
    expect(pages).toHaveLength(2)
    expect(pages[0].pageNum).toBe(1)
    expect(pages[1].pageNum).toBe(2)
  })

  it('each RenderedPage contains an HTMLCanvasElement', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    const file = new File(['%PDF-1.4 fake'], 'b.pdf', { type: 'application/pdf' })
    const pages = await renderPdfToCanvases(file)
    for (const page of pages) {
      expect(page.canvas).toBeInstanceOf(HTMLCanvasElement)
    }
  })

  it('renders at 2x scale (canvas dimensions are 2x viewport)', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    const file = new File(['%PDF-1.4 fake'], 'c.pdf', { type: 'application/pdf' })

    // single-page PDF for simplicity
    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: mockGetPage,
      }),
    })

    const pages = await renderPdfToCanvases(file)
    // getViewport called with scale: 2
    expect(mockGetViewport).toHaveBeenCalledWith({ scale: 2 })
    // canvas should be 800*2 × 600*2
    expect(pages[0].canvas.width).toBe(1600)
    expect(pages[0].canvas.height).toBe(1200)
  })

  it('calls onProgress for each page', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    const file = new File(['%PDF-1.4 fake'], 'd.pdf', { type: 'application/pdf' })
    const calls: [number, number][] = []
    await renderPdfToCanvases(file, (cur, total) => calls.push([cur, total]))
    expect(calls).toEqual([
      [1, 2],
      [2, 2],
    ])
  })

  it('onProgress is optional (no error if omitted)', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    const file = new File(['%PDF-1.4 fake'], 'e.pdf', { type: 'application/pdf' })
    await expect(renderPdfToCanvases(file)).resolves.toHaveLength(2)
  })

  it('reads file as ArrayBuffer before calling getDocument', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    const file = new File(['%PDF-1.4 fake'], 'f.pdf', { type: 'application/pdf' })
    const arrayBufferSpy = vi.spyOn(file, 'arrayBuffer')
    await renderPdfToCanvases(file)
    expect(arrayBufferSpy).toHaveBeenCalledOnce()
    expect(mockGetDocument).toHaveBeenCalledOnce()
  })

  it('throws descriptive error when getDocument rejects (corrupted PDF)', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    mockGetDocument.mockReturnValueOnce({
      promise: Promise.reject(new Error('Invalid PDF structure')),
    })
    const file = new File(['not a pdf'], 'bad.pdf', { type: 'application/pdf' })
    await expect(renderPdfToCanvases(file)).rejects.toThrow('Failed to load PDF')
  })

  it('returns empty array for PDF with 0 pages', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({ numPages: 0, getPage: mockGetPage }),
    })
    const file = new File(['%PDF-1.4'], 'empty.pdf', { type: 'application/pdf' })
    const pages = await renderPdfToCanvases(file)
    expect(pages).toHaveLength(0)
  })

  it('throws descriptive error when page render fails', async () => {
    const { renderPdfToCanvases } = await import('../utils/pdf-renderer')
    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({ numPages: 1, getPage: mockGetPage }),
    })
    mockRender.mockReturnValueOnce({ promise: Promise.reject(new Error('Render failed')) })
    const file = new File(['%PDF-1.4'], 'bad-page.pdf', { type: 'application/pdf' })
    await expect(renderPdfToCanvases(file)).rejects.toThrow('Failed to render page 1')
  })
})
