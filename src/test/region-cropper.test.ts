import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cropRegion } from '../utils/region-cropper'
import type { Region } from '../types'

// ── Canvas mock ──────────────────────────────────────────────────────────────
const drawImageMock = vi.fn()
const getContextMock = vi.fn(() => ({ drawImage: drawImageMock }))

beforeEach(() => {
  vi.clearAllMocks()
  // Patch createElement to return a mock canvas
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      const c = { width: 0, height: 0, getContext: getContextMock } as unknown as HTMLCanvasElement
      return c
    }
    return document.createElement(tag)
  })
})

function makeSource(width = 1000, height = 800): HTMLCanvasElement {
  return { width, height, getContext: getContextMock } as unknown as HTMLCanvasElement
}

function makeRegion(overrides: Partial<Region> = {}): Region {
  return { x: 100, y: 100, width: 300, height: 200, pageNum: 1, ...overrides }
}

describe('cropRegion — basic usage', () => {
  it('creates a canvas with region dimensions', () => {
    const src = makeSource()
    const region = makeRegion({ width: 300, height: 200 })
    const result = cropRegion(src, region)
    expect(result.width).toBe(300)
    expect(result.height).toBe(200)
  })

  it('calls drawImage with correct source and dest rects', () => {
    const src = makeSource()
    const region = makeRegion({ x: 50, y: 80, width: 200, height: 150 })
    cropRegion(src, region)
    expect(drawImageMock).toHaveBeenCalledWith(
      src, 50, 80, 200, 150, 0, 0, 200, 150
    )
  })

  it('returns the cropped canvas object', () => {
    const src = makeSource()
    const result = cropRegion(src, makeRegion())
    expect(result).toBeDefined()
    expect(typeof result.getContext).toBe('function')
  })
})

describe('cropRegion — minimum size validation', () => {
  it('throws when width < 50', () => {
    const src = makeSource()
    expect(() => cropRegion(src, makeRegion({ width: 49, height: 100 }))).toThrow(/too small/i)
  })

  it('throws when height < 50', () => {
    const src = makeSource()
    expect(() => cropRegion(src, makeRegion({ width: 100, height: 49 }))).toThrow(/too small/i)
  })

  it('does not throw at exactly 50×50', () => {
    const src = makeSource()
    expect(() => cropRegion(src, makeRegion({ width: 50, height: 50 }))).not.toThrow()
  })
})

describe('cropRegion — clamping to source bounds', () => {
  it('clamps region that extends beyond source right/bottom edge', () => {
    const src = makeSource(1000, 800)
    // Region extends 200px past right edge and 100px past bottom
    const region = makeRegion({ x: 900, y: 750, width: 300, height: 200 })
    const result = cropRegion(src, region)
    expect(result.width).toBe(100)  // 1000 - 900
    expect(result.height).toBe(50)  // 800 - 750
  })

  it('clamps x to zero minimum', () => {
    const src = makeSource(1000, 800)
    const region = makeRegion({ x: -50, y: 0, width: 300, height: 200 })
    cropRegion(src, region)
    // drawImage called with clamped x=0
    const call = drawImageMock.mock.calls[0]
    expect(call[1]).toBe(0) // clampedX
  })
})

describe('cropRegion — error on missing context', () => {
  it('throws if getContext returns null', () => {
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement
      }
      return document.createElement(tag)
    })
    expect(() => cropRegion(makeSource(), makeRegion())).toThrow(/canvas context/i)
  })
})
