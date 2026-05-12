import { useMemo } from 'react'
import type { RenderedPage } from '../utils/pdf-renderer'

interface PdfPageViewerProps {
  label: string
  pages: RenderedPage[]
  currentPage: number
  onPageChange: (page: number) => void
}

export function PdfPageViewer({ label, pages, currentPage, onPageChange }: PdfPageViewerProps) {
  const total = pages.length
  const page = pages[currentPage - 1]

  const imgSrc = useMemo(() => {
    if (!page) return ''
    return page.canvas.toDataURL('image/png')
  }, [page])

  function goTo(n: number) {
    const clamped = Math.max(1, Math.min(total, n))
    onPageChange(clamped)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = parseInt((e.target as HTMLInputElement).value, 10)
      if (!isNaN(val)) goTo(val)
    }
  }

  const canvasWidth = page?.canvas.width ?? 0
  const canvasHeight = page?.canvas.height ?? 0

  return (
    <div className="pdf-page-viewer">
      <div className="pdf-page-viewer-header">
        <span className="pdf-page-viewer-label">{label}</span>
        <span className="pdf-page-viewer-dims">
          {canvasWidth > 0 ? `${canvasWidth} × ${canvasHeight} px` : ''}
        </span>
      </div>

      <div className="pdf-page-viewer-image-wrap">
        {imgSrc ? (
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
            onKeyDown={handleKeyDown}
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
