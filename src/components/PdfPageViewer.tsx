import { useMemo, useState } from 'react'
import type { RenderedPage } from '../utils/pdf-renderer'
import type { Region } from '../types'
import { RegionSelector } from './RegionSelector'

interface PdfPageViewerProps {
  label: string
  pages: RenderedPage[]
  currentPage: number
  onPageChange: (page: number) => void
  /** When provided, renders RegionSelector overlay instead of a plain image */
  onRegionChange?: (region: Region | null) => void
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
const ZOOM_LABELS: Record<number, string> = {
  0.5: '50%', 0.75: '75%', 1.0: '100%', 1.25: '125%', 1.5: '150%', 2.0: '200%',
}

export function PdfPageViewer({ label, pages, currentPage, onPageChange, onRegionChange }: PdfPageViewerProps) {
  const total = pages.length
  const page = pages[currentPage - 1]
  const [zoom, setZoom] = useState(1.0)

  const imgSrc = useMemo(() => {
    if (!page) return ''
    return page.canvas.toDataURL('image/png')
  }, [page])

  function goTo(n: number) {
    const clamped = Math.max(1, Math.min(total, n))
    onPageChange(clamped)
  }

  function zoomIn() {
    setZoom(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev)
      return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : prev
    })
  }

  function zoomOut() {
    setZoom(prev => {
      const idx = ZOOM_LEVELS.indexOf(prev)
      return idx > 0 ? ZOOM_LEVELS[idx - 1] : prev
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentPage - 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentPage + 1) }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = parseInt((e.target as HTMLInputElement).value, 10)
      if (!isNaN(val)) goTo(val)
    }
  }

  const canvasWidth = page?.canvas.width ?? 0
  const canvasHeight = page?.canvas.height ?? 0

  return (
    <div className="pdf-page-viewer" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="pdf-page-viewer-header">
        <span className="pdf-page-viewer-label">{label}</span>
        <div className="pdf-page-viewer-zoom-controls">
          <button
            className="btn-zoom"
            onClick={zoomOut}
            disabled={zoom <= ZOOM_LEVELS[0]}
            aria-label="Zoom out"
          >−</button>
          <span className="zoom-level">{ZOOM_LABELS[zoom] ?? `${Math.round(zoom * 100)}%`}</span>
          <button
            className="btn-zoom"
            onClick={zoomIn}
            disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            aria-label="Zoom in"
          >+</button>
        </div>
        <span className="pdf-page-viewer-dims">
          {canvasWidth > 0 ? `${canvasWidth} × ${canvasHeight} px` : ''}
        </span>
      </div>

      <div className="pdf-page-viewer-image-wrap">
        <div className="pdf-page-viewer-zoom-wrap" style={{ width: `${Math.round(zoom * 100)}%` }}>
          {onRegionChange ? (
            <RegionSelector
              sourceCanvas={page?.canvas ?? null}
              pageNum={currentPage}
              onRegionChange={onRegionChange}
            />
          ) : imgSrc ? (
            <img
              src={imgSrc}
              alt={`${label} page ${currentPage}`}
              className="pdf-page-viewer-img"
              draggable={false}
            />
          ) : (
            <div className="pdf-page-viewer-placeholder">No page</div>
          )}
        </div>
      </div>

      <div className="pdf-page-nav">
        <button
          className="btn-page-nav"
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="page-label">
          Page{' '}
          <input
            className="page-input"
            type="number"
            min={1}
            max={total}
            defaultValue={currentPage}
            key={currentPage}
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val)) goTo(val)
            }}
            onKeyDown={handleInputKeyDown}
            aria-label="Page number"
          />{' '}
          / {total}
        </span>
        <button
          className="btn-page-nav"
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= total}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Page {currentPage} of {total}
      </div>
    </div>
  )
}
