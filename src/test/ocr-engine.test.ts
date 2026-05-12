import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock tesseract.js before importing ocr-engine
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: vi.fn(async () => ({ data: { text: 'mocked OCR text' } })),
    terminate: vi.fn(async () => {}),
  })),
}))

// Reset worker singleton between tests
afterEach(async () => {
  // Re-import fresh module to reset singleton
  vi.resetModules()
})

describe('ocr-engine', () => {
  it('extractTextFromCanvases returns text from canvases', async () => {
    const { extractTextFromCanvases } = await import('../utils/ocr-engine')
    const canvas = document.createElement('canvas')
    const result = await extractTextFromCanvases([canvas])
    expect(result).toContain('mocked OCR text')
  })

  it('calls onProgress during OCR', async () => {
    const { extractTextFromCanvases } = await import('../utils/ocr-engine')
    const canvas = document.createElement('canvas')
    const progressEvents: { status: string; progress: number }[] = []
    await extractTextFromCanvases([canvas], (evt) => progressEvents.push(evt))
    expect(progressEvents.length).toBeGreaterThan(0)
    const lastEvent = progressEvents[progressEvents.length - 1]
    expect(lastEvent.status).toBe('Done')
    expect(lastEvent.progress).toBe(1)
  })

  it('concatenates text across multiple pages', async () => {
    const { extractTextFromCanvases } = await import('../utils/ocr-engine')
    const canvases = [document.createElement('canvas'), document.createElement('canvas')]
    const result = await extractTextFromCanvases(canvases)
    expect(result).toContain('--- Page Break ---')
  })

  it('terminateOcrWorker cleans up worker', async () => {
    const { extractTextFromCanvases, terminateOcrWorker } = await import('../utils/ocr-engine')
    // Initialize worker first
    await extractTextFromCanvases([document.createElement('canvas')])
    // Should not throw
    await expect(terminateOcrWorker()).resolves.toBeUndefined()
  })

  it('returns empty string for empty canvas array', async () => {
    const { extractTextFromCanvases } = await import('../utils/ocr-engine')
    const result = await extractTextFromCanvases([])
    expect(result).toBe('')
  })

  it('reuses the same worker across multiple calls (singleton)', async () => {
    const tesseract = await import('tesseract.js')
    const createWorkerSpy = vi.mocked(tesseract.createWorker)
    createWorkerSpy.mockClear() // isolate call count for this test
    const { extractTextFromCanvases } = await import('../utils/ocr-engine')
    const canvas = document.createElement('canvas')
    await extractTextFromCanvases([canvas])
    await extractTextFromCanvases([canvas])
    expect(createWorkerSpy).toHaveBeenCalledTimes(1)
  })

  it('wraps recognize errors with page context', async () => {
    const tesseract = await import('tesseract.js')
    vi.mocked(tesseract.createWorker).mockResolvedValueOnce({
      recognize: vi.fn().mockRejectedValue(new Error('GPU crash')),
      terminate: vi.fn().mockResolvedValue(undefined),
    } as never)
    const { extractTextFromCanvases } = await import('../utils/ocr-engine')
    const canvas = document.createElement('canvas')
    await expect(extractTextFromCanvases([canvas])).rejects.toThrow('OCR failed on page 1: GPU crash')
  })

  it('wraps timeout errors with page context', async () => {
    vi.useFakeTimers()
    try {
      const tesseract = await import('tesseract.js')
      vi.mocked(tesseract.createWorker).mockResolvedValue({
        recognize: vi.fn(() => new Promise(() => {})), // never resolves
        terminate: vi.fn().mockResolvedValue(undefined),
      } as never)
      const { extractTextFromCanvases } = await import('../utils/ocr-engine')
      const canvas = document.createElement('canvas')
      const pending = extractTextFromCanvases([canvas])
      // Flush pending microtasks so the OCR loop reaches the withTimeout call
      for (let i = 0; i < 5; i++) await Promise.resolve()
      vi.runAllTimers()
      await expect(pending).rejects.toThrow('OCR failed on page 1: OCR timed out after 30s')
    } finally {
      vi.useRealTimers()
    }
  })

  it('serializes concurrent calls so worker is not shared simultaneously', async () => {
    const callOrder: string[] = []
    const tesseract = await import('tesseract.js')
    vi.mocked(tesseract.createWorker).mockResolvedValue({
      recognize: vi.fn(async () => {
        callOrder.push('recognize-start')
        await Promise.resolve() // yield to event loop
        callOrder.push('recognize-end')
        return { data: { text: 'text' } }
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    } as never)
    const { extractTextFromCanvases } = await import('../utils/ocr-engine')
    const canvas = document.createElement('canvas')
    // Launch two concurrent extractions
    const [r1, r2] = await Promise.all([
      extractTextFromCanvases([canvas]),
      extractTextFromCanvases([canvas]),
    ])
    expect(r1).toBe('text')
    expect(r2).toBe('text')
    // All of first call's recognize-start/end must appear before second call's
    const firstEnd = callOrder.indexOf('recognize-end')
    const secondStart = callOrder.lastIndexOf('recognize-start')
    expect(firstEnd).toBeLessThan(secondStart)
  })
})
