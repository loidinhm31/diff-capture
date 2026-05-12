import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RegionSelector } from '../components/RegionSelector'
import type { Region } from '../types'

// ── Canvas mocks ─────────────────────────────────────────────────────────────
const ctxMock = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  setLineDash: vi.fn(),
}
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ctxMock),
  writable: true,
})
// Return a truthy data URL so RegionSelector renders the img + overlay canvas
Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: vi.fn(() => 'data:image/png;base64,ABC'),
  writable: true,
})
// setPointerCapture is not in jsdom
Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
  value: vi.fn(),
  writable: true,
})

// ── ResizeObserver mock ──────────────────────────────────────────────────────
const roObserve = vi.fn()
const roDisconnect = vi.fn()
class MockResizeObserver {
  cb: ResizeObserverCallback
  observe = roObserve
  disconnect = roDisconnect
  unobserve = vi.fn()
  constructor(cb: ResizeObserverCallback) { this.cb = cb }
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

// ── Helper ────────────────────────────────────────────────────────────────────
function makeSourceCanvas(width = 1000, height = 800) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function renderSelector(onRegionChange = vi.fn(), pageNum = 1) {
  const sourceCanvas = makeSourceCanvas()
  render(
    <RegionSelector sourceCanvas={sourceCanvas} pageNum={pageNum} onRegionChange={onRegionChange} />
  )
  return { sourceCanvas, onRegionChange }
}

// ── Pointer event helper ─────────────────────────────────────────────────────
function getOverlayCanvas() {
  // The overlay canvas has the aria-label
  return screen.getByLabelText('Draw selection rectangle') as HTMLCanvasElement
}

function pointerDown(el: Element, x: number, y: number) {
  fireEvent(el, new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }))
}
function pointerMove(el: Element, x: number, y: number) {
  fireEvent(el, new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }))
}
function pointerUp(el: Element, x: number, y: number) {
  fireEvent(el, new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y }))
}

beforeEach(() => {
  vi.clearAllMocks()
  // Simulate overlay canvas bounding rect at (0,0) with display 500×400
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0, top: 0, right: 500, bottom: 400,
    width: 500, height: 400, x: 0, y: 0, toJSON: () => ({}),
  }))
  // Simulate display sizes for coordinate mapping
  Object.defineProperty(HTMLCanvasElement.prototype, 'offsetWidth', { get: () => 500, configurable: true })
  Object.defineProperty(HTMLCanvasElement.prototype, 'offsetHeight', { get: () => 400, configurable: true })
  Object.defineProperty(HTMLImageElement.prototype, 'offsetWidth', { get: () => 500, configurable: true })
  Object.defineProperty(HTMLImageElement.prototype, 'offsetHeight', { get: () => 400, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RegionSelector — rendering', () => {
  it('renders placeholder and disabled clear button when no canvas', () => {
    render(<RegionSelector sourceCanvas={null} pageNum={1} onRegionChange={vi.fn()} />)
    expect(screen.getByText('No page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled()
  })

  it('renders canvas overlay and hint text when source canvas provided', () => {
    renderSelector()
    expect(screen.getByText(/draw a rectangle/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled()
  })

  it('renders img element with draggable=false', () => {
    renderSelector()
    const img = document.querySelector('img.region-selector-img')!
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('draggable', 'false')
  })

  it('renders overlay canvas with correct aria-label', () => {
    renderSelector()
    expect(screen.getByLabelText('Draw selection rectangle')).toBeInTheDocument()
  })
})

describe('RegionSelector — drag interaction', () => {
  it('calls onRegionChange(null) when drag is too small', () => {
    const onRegionChange = vi.fn()
    renderSelector(onRegionChange)
    const canvas = getOverlayCanvas()
    pointerDown(canvas, 10, 10)
    pointerUp(canvas, 15, 15) // < MIN_SIZE (10px display)
    expect(onRegionChange).toHaveBeenCalledWith(null)
  })

  it('calls onRegionChange with a Region when drag is large enough', () => {
    const onRegionChange = vi.fn()
    renderSelector(onRegionChange)
    const canvas = getOverlayCanvas()
    pointerDown(canvas, 50, 50)
    pointerMove(canvas, 150, 150)
    pointerUp(canvas, 150, 150)

    expect(onRegionChange).toHaveBeenCalled()
    const region: Region = onRegionChange.mock.calls.at(-1)?.[0]
    expect(region).toBeDefined()
    expect(region.pageNum).toBe(1)
    expect(region.width).toBeGreaterThan(0)
    expect(region.height).toBeGreaterThan(0)
  })

  it('maps display coordinates to source canvas coordinates (2x scale)', () => {
    // Display: 500×400, Source canvas: 1000×800 (SCALE=2)
    // scaleX = 1000/500 = 2, scaleY = 800/400 = 2
    const onRegionChange = vi.fn()
    renderSelector(onRegionChange)
    const canvas = getOverlayCanvas()
    pointerDown(canvas, 100, 80)
    pointerUp(canvas, 200, 180)

    const region: Region = onRegionChange.mock.calls.at(-1)?.[0]
    expect(region).toBeDefined()
    // Display: start(100,80) end(200,180) → size 100×100 at display
    // Source: x=200, y=160, w=200, h=200
    expect(region.x).toBe(200)
    expect(region.y).toBe(160)
    expect(region.width).toBe(200)
    expect(region.height).toBe(200)
  })

  it('handles drag in reverse direction (negative width/height normalized)', () => {
    const onRegionChange = vi.fn()
    renderSelector(onRegionChange)
    const canvas = getOverlayCanvas()
    // Drag from bottom-right to top-left
    pointerDown(canvas, 200, 200)
    pointerUp(canvas, 50, 50)

    const region: Region = onRegionChange.mock.calls.at(-1)?.[0]
    expect(region).toBeDefined()
    expect(region.x).toBeGreaterThanOrEqual(0)
    expect(region.y).toBeGreaterThanOrEqual(0)
    expect(region.width).toBeGreaterThan(0)
    expect(region.height).toBeGreaterThan(0)
  })
})

describe('RegionSelector — clear button', () => {
  it('calls onRegionChange(null) when clear button clicked', () => {
    const onRegionChange = vi.fn()
    renderSelector(onRegionChange)
    const canvas = getOverlayCanvas()
    // First draw a valid region
    pointerDown(canvas, 50, 50)
    pointerUp(canvas, 200, 200)

    vi.clearAllMocks()
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onRegionChange).toHaveBeenCalledWith(null)
  })
})

describe('RegionSelector — pageNum passthrough', () => {
  it('includes correct pageNum in region', () => {
    const onRegionChange = vi.fn()
    renderSelector(onRegionChange, 3)
    const canvas = getOverlayCanvas()
    pointerDown(canvas, 50, 50)
    pointerUp(canvas, 200, 200)

    const region: Region = onRegionChange.mock.calls.at(-1)?.[0]
    expect(region?.pageNum).toBe(3)
  })
})
