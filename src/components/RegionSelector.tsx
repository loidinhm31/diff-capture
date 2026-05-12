import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { Region } from '../types'

interface DisplayRect {
  x: number
  y: number
  width: number
  height: number
}

interface RegionSelectorProps {
  /** The source canvas (full-resolution rendered PDF page). Used for coordinate mapping & dimensions. */
  sourceCanvas: HTMLCanvasElement | null
  pageNum: number
  onRegionChange: (region: Region | null) => void
}

const MIN_SIZE = 10 // minimum drag size in display pixels before registering

export function RegionSelector({ sourceCanvas, pageNum, onRegionChange }: RegionSelectorProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Display-space rect during drag / after selection
  const [displayRect, setDisplayRect] = useState<DisplayRect | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  // Track canvas resize to trigger overlay redraw
  const [canvasVersion, setCanvasVersion] = useState(0)

  // ── Sync overlay canvas size to match image render size ────────────────────
  useEffect(() => {
    if (!overlayRef.current || !imageRef.current || !sourceCanvas) return
    const img = imageRef.current
    const canvas = overlayRef.current
    const syncSize = () => {
      canvas.width = img.offsetWidth
      canvas.height = img.offsetHeight
      // Setting canvas.width/height clears the buffer — bump version to trigger redraw
      setCanvasVersion((v) => v + 1)
    }
    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(img)
    return () => ro.disconnect()
  }, [sourceCanvas])

  // ── Redraw overlay whenever displayRect changes or canvas is resized ───────
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!displayRect || displayRect.width === 0 || displayRect.height === 0) return

    const { x, y, width, height } = normalizeRect(displayRect)

    // Semi-transparent fill
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(x, y, width, height)

    // Dashed border
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 3])
    ctx.strokeRect(x, y, width, height)

    // Corner handles
    ctx.setLineDash([])
    ctx.fillStyle = '#3b82f6'
    const handleSize = 6
    const corners = [
      [x, y], [x + width, y], [x, y + height], [x + width, y + height],
    ]
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize)
    }
  }, [displayRect, canvasVersion])

  // ── Map display coordinates → source canvas coordinates ────────────────────
  function toSourceCoords(rect: DisplayRect): Region {
    const canvas = overlayRef.current
    const imgEl = imageRef.current
    if (!canvas || !imgEl || !sourceCanvas) {
      return { x: 0, y: 0, width: 0, height: 0, pageNum }
    }
    const displayW = imgEl.offsetWidth
    const displayH = imgEl.offsetHeight
    const scaleX = sourceCanvas.width / displayW
    const scaleY = sourceCanvas.height / displayH

    const { x, y, width, height } = normalizeRect(rect)
    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY),
      width: Math.round(width * scaleX),
      height: Math.round(height * scaleY),
      pageNum,
    }
  }

  // ── Pointer event helpers ───────────────────────────────────────────────────
  function getRelativePos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = overlayRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    overlayRef.current?.setPointerCapture(e.pointerId)
    const pos = getRelativePos(e)
    dragStart.current = pos
    isDragging.current = true
    setDisplayRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStart.current) return
    const pos = getRelativePos(e)
    setDisplayRect({
      x: dragStart.current.x,
      y: dragStart.current.y,
      width: pos.x - dragStart.current.x,
      height: pos.y - dragStart.current.y,
    })
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStart.current) return
    isDragging.current = false
    const pos = getRelativePos(e)
    const finalDisplay: DisplayRect = {
      x: dragStart.current.x,
      y: dragStart.current.y,
      width: pos.x - dragStart.current.x,
      height: pos.y - dragStart.current.y,
    }
    dragStart.current = null

    const norm = normalizeRect(finalDisplay)
    if (norm.width < MIN_SIZE || norm.height < MIN_SIZE) {
      // Too small — treat as deselect
      setDisplayRect(null)
      onRegionChange(null)
      return
    }
    setDisplayRect(finalDisplay)
    onRegionChange(toSourceCoords(finalDisplay))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, sourceCanvas])

  function handleClear() {
    setDisplayRect(null)
    onRegionChange(null)
  }

  // ── Escape key clears current selection ────────────────────────────────────
  const onRegionChangeRef = useRef(onRegionChange)
  useEffect(() => { onRegionChangeRef.current = onRegionChange }, [onRegionChange])
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDisplayRect(null)
        onRegionChangeRef.current(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Build the image src from source canvas — memoized to avoid regenerating on every render
  const imgSrc = useMemo(
    () => (sourceCanvas ? sourceCanvas.toDataURL('image/png') : ''),
    [sourceCanvas]
  )

  return (
    <div className="region-selector-wrap" ref={containerRef}>
      {imgSrc ? (
        <>
          <img
            ref={imageRef}
            src={imgSrc}
            alt={`Page ${pageNum}`}
            className="region-selector-img"
            draggable={false}
          />
          <canvas
            ref={overlayRef}
            className="region-selector-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            aria-label="Draw selection rectangle"
          />
        </>
      ) : (
        <div className="region-selector-placeholder">No page</div>
      )}

      <div className="region-selector-footer">
        {displayRect && normalizeRect(displayRect).width >= MIN_SIZE ? (
          <span className="region-selector-hint" aria-live="polite">Region selected</span>
        ) : (
          <span className="region-selector-hint" aria-live="polite">Draw a rectangle to select a region</span>
        )}
        <button
          className="btn-clear-region"
          onClick={handleClear}
          disabled={!displayRect}
          aria-label="Clear selection"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

// ── Normalize rect so width/height are always positive ─────────────────────
function normalizeRect(r: DisplayRect): DisplayRect {
  const x = r.width < 0 ? r.x + r.width : r.x
  const y = r.height < 0 ? r.y + r.height : r.y
  return { x, y, width: Math.abs(r.width), height: Math.abs(r.height) }
}
