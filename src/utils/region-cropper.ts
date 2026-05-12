import type { Region } from '../types'

/**
 * Crops a region from a source canvas and returns a new canvas containing only that region.
 * Validates minimum size (50×50 px at source scale per plan spec).
 *
 * Memory note: The returned canvas is a short-lived HTMLCanvasElement. Callers should
 * free it when done by setting `canvas.width = canvas.height = 0`.
 */
export function cropRegion(sourceCanvas: HTMLCanvasElement, region: Region): HTMLCanvasElement {
  const { x, y, width, height } = region

  if (width < 50 || height < 50) {
    throw new Error(`Selected region is too small (${width}×${height} px). Minimum is 50×50 px.`)
  }

  // Clamp to source canvas bounds
  const clampedX = Math.max(0, Math.min(x, sourceCanvas.width))
  const clampedY = Math.max(0, Math.min(y, sourceCanvas.height))
  const clampedW = Math.min(width, sourceCanvas.width - clampedX)
  const clampedH = Math.min(height, sourceCanvas.height - clampedY)

  const dest = document.createElement('canvas')
  dest.width = clampedW
  dest.height = clampedH

  const ctx = dest.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2D canvas context for crop')

  ctx.drawImage(
    sourceCanvas,
    clampedX, clampedY, clampedW, clampedH,  // source rect
    0, 0, clampedW, clampedH                  // dest rect
  )

  return dest
}
