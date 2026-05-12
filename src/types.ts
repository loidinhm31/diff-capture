/**
 * Rectangular region selection on a PDF page (source canvas coordinates).
 * Coordinates are in full-resolution canvas space (typically 2× display size due to SCALE=2).
 */
export interface Region {
  /** X origin (px) in source canvas space */
  x: number
  /** Y origin (px) in source canvas space */
  y: number
  /** Width (px) in source canvas space */
  width: number
  /** Height (px) in source canvas space */
  height: number
  /** 1-based page number this region belongs to */
  pageNum: number
}
