import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PdfPageViewer } from '../components/PdfPageViewer'
import type { Region } from '../types'
import type { RenderedPage } from '../utils/pdf-renderer'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../components/RegionSelector', () => ({
  RegionSelector: ({
    pageNum,
    onRegionChange,
  }: {
    pageNum: number
    onRegionChange: (region: Region | null) => void
  }) => (
    <div data-testid={`region-selector-${pageNum}`} onClick={() => onRegionChange(null)} />
  ),
}))

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: vi.fn(() => 'data:image/png;base64,ABC'),
  writable: true,
})

// ── Helpers ────────────────────────────────────────────────────────────────
function makePages(n: number, width = 800, height = 1100): RenderedPage[] {
  return Array.from({ length: n }, (_, i) => {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return { pageNum: i + 1, canvas: c }
  })
}

function renderViewer(
  opts: Partial<{
    label: string
    pages: RenderedPage[]
    currentPage: number
    onPageChange: (p: number) => void
    onRegionChange: (region: Region | null) => void
  }> = {}
) {
  const defaults = {
    label: 'Test',
    pages: makePages(3),
    currentPage: 1,
    onPageChange: vi.fn(),
  }
  return render(<PdfPageViewer {...defaults} {...opts} />)
}

beforeEach(() => vi.clearAllMocks())

// ── Rendering ──────────────────────────────────────────────────────────────
describe('PdfPageViewer — rendering', () => {
  it('shows the label', () => {
    renderViewer({ label: 'PDF A' })
    expect(screen.getByText('PDF A')).toBeInTheDocument()
  })

  it('shows canvas dimensions', () => {
    renderViewer({ pages: makePages(1, 800, 1100) })
    expect(screen.getByText('800 × 1100 px')).toBeInTheDocument()
  })

  it('shows placeholder when no pages', () => {
    renderViewer({ pages: [] })
    expect(screen.getByText('No page')).toBeInTheDocument()
  })

  it('renders RegionSelector overlay when onRegionChange provided', () => {
    renderViewer({ onRegionChange: vi.fn() })
    expect(screen.getByTestId('region-selector-1')).toBeInTheDocument()
  })

  it('renders page image when onRegionChange not provided', () => {
    renderViewer()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('has tabIndex for keyboard focus', () => {
    const { container } = renderViewer()
    expect(container.querySelector('.pdf-page-viewer')).toHaveAttribute('tabindex', '0')
  })
})

// ── Page navigation ────────────────────────────────────────────────────────
describe('PdfPageViewer — page navigation', () => {
  it('prev button calls onPageChange with page - 1', () => {
    const onPageChange = vi.fn()
    renderViewer({ currentPage: 2, onPageChange })
    fireEvent.click(screen.getByLabelText(/previous page/i))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('next button calls onPageChange with page + 1', () => {
    const onPageChange = vi.fn()
    renderViewer({ currentPage: 1, onPageChange })
    fireEvent.click(screen.getByLabelText(/next page/i))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('prev button is disabled on first page', () => {
    renderViewer({ currentPage: 1 })
    expect(screen.getByLabelText(/previous page/i)).toBeDisabled()
  })

  it('next button is disabled on last page', () => {
    renderViewer({ currentPage: 3, pages: makePages(3) })
    expect(screen.getByLabelText(/next page/i)).toBeDisabled()
  })

  it('shows correct page count', () => {
    renderViewer({ pages: makePages(5) })
    expect(screen.getByText(/\/ 5/)).toBeInTheDocument()
  })
})

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
describe('PdfPageViewer — keyboard shortcuts', () => {
  it('ArrowLeft navigates to prev page', () => {
    const onPageChange = vi.fn()
    const { container } = renderViewer({ currentPage: 2, onPageChange })
    fireEvent.keyDown(container.querySelector('.pdf-page-viewer')!, { key: 'ArrowLeft' })
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('ArrowRight navigates to next page', () => {
    const onPageChange = vi.fn()
    const { container } = renderViewer({ currentPage: 1, onPageChange })
    fireEvent.keyDown(container.querySelector('.pdf-page-viewer')!, { key: 'ArrowRight' })
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('ArrowLeft on first page clamps to 1', () => {
    const onPageChange = vi.fn()
    const { container } = renderViewer({ currentPage: 1, onPageChange })
    fireEvent.keyDown(container.querySelector('.pdf-page-viewer')!, { key: 'ArrowLeft' })
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('ArrowRight on last page clamps to last', () => {
    const onPageChange = vi.fn()
    const { container } = renderViewer({ currentPage: 3, pages: makePages(3), onPageChange })
    fireEvent.keyDown(container.querySelector('.pdf-page-viewer')!, { key: 'ArrowRight' })
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('other keys do not trigger navigation', () => {
    const onPageChange = vi.fn()
    const { container } = renderViewer({ currentPage: 2, onPageChange })
    fireEvent.keyDown(container.querySelector('.pdf-page-viewer')!, { key: 'Enter' })
    expect(onPageChange).not.toHaveBeenCalled()
  })
})

// ── Zoom controls ──────────────────────────────────────────────────────────
describe('PdfPageViewer — zoom', () => {
  it('shows zoom in and zoom out buttons', () => {
    renderViewer()
    expect(screen.getByLabelText(/zoom in/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/zoom out/i)).toBeInTheDocument()
  })

  it('defaults to 100%', () => {
    renderViewer()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('zoom in increases level', () => {
    renderViewer()
    fireEvent.click(screen.getByLabelText(/zoom in/i))
    expect(screen.getByText('125%')).toBeInTheDocument()
  })

  it('zoom out decreases level', () => {
    renderViewer()
    fireEvent.click(screen.getByLabelText(/zoom out/i))
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('zoom out is disabled at minimum (50%)', () => {
    renderViewer()
    const btn = screen.getByLabelText(/zoom out/i)
    fireEvent.click(btn) // 75%
    fireEvent.click(btn) // 50%
    expect(btn).toBeDisabled()
  })

  it('zoom in is disabled at maximum (200%)', () => {
    renderViewer()
    const btn = screen.getByLabelText(/zoom in/i)
    fireEvent.click(btn) // 125%
    fireEvent.click(btn) // 150%
    fireEvent.click(btn) // 200%
    expect(btn).toBeDisabled()
  })
})
