import { useCallback, useEffect, useRef, useState } from 'react'
import type { Region } from '../types'
import { RegionSelector } from './RegionSelector'

interface PasteImagePanelProps {
  pageNum: number
  onRegionChange?: (region: Region | null) => void
  onCanvasChange?: (canvas: HTMLCanvasElement | null) => void
}

export function PasteImagePanel({ pageNum, onRegionChange, onCanvasChange }: PasteImagePanelProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue

        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          const ctx = c.getContext('2d')
          if (!ctx) return
          ctx.drawImage(img, 0, 0)
          setCanvas(c)
          onCanvasChange?.(c)
          URL.revokeObjectURL(img.src)
        }
        img.src = URL.createObjectURL(blob)
        break
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  function handleClear() {
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
    setCanvas(null)
    onCanvasChange?.(null)
    onRegionChange?.(null)
  }

  if (!canvas) {
    return (
      <div className="paste-image-panel-empty" ref={containerRef}>
        <div className="paste-image-hint">
          <span className="paste-icon">📋</span>
          <p>Paste a screenshot here</p>
          <p className="paste-subhint">Use Ctrl+V (or Cmd+V) to paste an image from clipboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="paste-image-panel" ref={containerRef}>
      <div className="paste-image-toolbar">
        <span className="paste-image-dims">{canvas.width} × {canvas.height} px</span>
        <button className="btn-paste-clear" onClick={handleClear}>Clear</button>
      </div>
      <div className="paste-image-content">
        {onRegionChange ? (
          <RegionSelector
            sourceCanvas={canvas}
            pageNum={pageNum}
            onRegionChange={onRegionChange}
          />
        ) : (
          <img
            src={canvas.toDataURL('image/png')}
            alt="Pasted screenshot"
            className="paste-image-img"
            draggable={false}
          />
        )}
      </div>
    </div>
  )
}
