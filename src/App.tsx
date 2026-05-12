import { useState, useCallback, lazy, Suspense } from 'react'
import { PdfUploader } from './components/PdfUploader'
import { OcrProgress } from './components/OcrProgress'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PdfPageViewer } from './components/PdfPageViewer'
import type { OcrProgressEvent } from './utils/ocr-engine'
import type { RenderedPage } from './utils/pdf-renderer'
import type { Region } from './types'
import './App.css'

// Code-split heavy diff viewer — only loaded after OCR completes
const DiffViewer = lazy(() =>
  import('./components/DiffViewer').then((m) => ({ default: m.DiffViewer }))
)

type Phase = 'idle' | 'rendering' | 'preview' | 'processing' | 'done' | 'error'

interface ProgressState {
  label: string
  status: string
  progress: number
}

export default function App() {
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [progressA, setProgressA] = useState<ProgressState>({ label: 'PDF A', status: '', progress: 0 })
  const [progressB, setProgressB] = useState<ProgressState>({ label: 'PDF B', status: '', progress: 0 })
  const [pagesA, setPagesA] = useState<RenderedPage[]>([])
  const [pagesB, setPagesB] = useState<RenderedPage[]>([])
  const [currentPageA, setCurrentPageA] = useState(1)
  const [currentPageB, setCurrentPageB] = useState(1)
  const [regionA, setRegionA] = useState<Region | null>(null)
  const [regionB, setRegionB] = useState<Region | null>(null)
  const [syncPages, setSyncPages] = useState(false)
  const [previewExpanded, setPreviewExpanded] = useState(true)

  const isBusy = phase === 'rendering' || phase === 'processing'
  const canPreview = fileA !== null && fileB !== null && !isBusy
  const canCompare = fileA !== null && fileB !== null && !isBusy
  const canCompareRegions = canCompare && phase === 'preview' && regionA !== null && regionB !== null

  const processFile = useCallback(async (
    file: File,
    setProgress: React.Dispatch<React.SetStateAction<ProgressState>>,
    label: string
  ): Promise<string> => {
    // Dynamic imports: pdfjs-dist and tesseract.js load only on first Compare click
    const [{ renderPdfToCanvases }, { extractTextFromCanvases }] = await Promise.all([
      import('./utils/pdf-renderer'),
      import('./utils/ocr-engine'),
    ])
    const pages = await renderPdfToCanvases(file, (cur, total) => {
      setProgress({ label, status: `Rendering page ${cur}/${total}`, progress: cur / total * 0.5 })
    })
    const canvases = pages.map((p) => p.canvas)
    const ocrProgressCb = (evt: OcrProgressEvent) => {
      setProgress({ label, status: evt.status, progress: 0.5 + evt.progress * 0.5 })
    }
    return extractTextFromCanvases(canvases, ocrProgressCb)
  }, [])

  async function handlePreview() {
    if (!fileA || !fileB) return
    setPhase('rendering')
    setError(null)
    setPagesA([])
    setPagesB([])
    setCurrentPageA(1)
    setCurrentPageB(1)
    try {
      const { renderPdfToCanvases } = await import('./utils/pdf-renderer')
      const [renderedA, renderedB] = await Promise.all([
        renderPdfToCanvases(fileA, (cur, total) =>
          setProgressA({ label: 'PDF A', status: `Rendering page ${cur}/${total}`, progress: cur / total })
        ),
        renderPdfToCanvases(fileB, (cur, total) =>
          setProgressB({ label: 'PDF B', status: `Rendering page ${cur}/${total}`, progress: cur / total })
        ),
      ])
      setPagesA(renderedA)
      setPagesB(renderedB)
      setPhase('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setPhase('error')
    }
  }

  async function handleCompareRegions() {
    if (!regionA || !regionB) return
    const pageA = pagesA[regionA.pageNum - 1]
    const pageB = pagesB[regionB.pageNum - 1]
    if (!pageA || !pageB) return
    setPhase('processing')
    setError(null)
    setTextA('')
    setTextB('')
    try {
      const { cropRegion } = await import('./utils/region-cropper')
      const { extractTextFromCanvases } = await import('./utils/ocr-engine')
      const croppedA = cropRegion(pageA.canvas, regionA)
      const croppedB = cropRegion(pageB.canvas, regionB)
      const ocrProgressA = (evt: OcrProgressEvent) =>
        setProgressA({ label: 'Region A', status: evt.status, progress: evt.progress })
      const ocrProgressB = (evt: OcrProgressEvent) =>
        setProgressB({ label: 'Region B', status: evt.status, progress: evt.progress })
      const [extractedA, extractedB] = await Promise.all([
        extractTextFromCanvases([croppedA], ocrProgressA),
        extractTextFromCanvases([croppedB], ocrProgressB),
      ])
      setTextA(extractedA)
      setTextB(extractedB)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setPhase('error')
    }
  }

  async function handleCompare() {
    if (!fileA || !fileB) return
    setPhase('processing')
    setError(null)
    setTextA('')
    setTextB('')
    try {
      const [extractedA, extractedB] = await Promise.all([
        processFile(fileA, setProgressA, 'PDF A'),
        processFile(fileB, setProgressB, 'PDF B'),
      ])
      setTextA(extractedA)
      setTextB(extractedB)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setPhase('error')
    }
  }

  function handleReset() {
    setFileA(null)
    setFileB(null)
    setTextA('')
    setTextB('')
    setError(null)
    setPhase('idle')
    setRegionA(null)
    setRegionB(null)
    setSyncPages(false)
    // Free canvas memory
    setPagesA((prev) => { prev.forEach((p) => { p.canvas.width = 0; p.canvas.height = 0 }); return [] })
    setPagesB((prev) => { prev.forEach((p) => { p.canvas.width = 0; p.canvas.height = 0 }); return [] })
    setCurrentPageA(1)
    setCurrentPageB(1)
    setProgressA({ label: 'PDF A', status: '', progress: 0 })
    setProgressB({ label: 'PDF B', status: '', progress: 0 })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF OCR Compare</h1>
        <p className="app-subtitle">Extract text from PDFs via OCR and compare side-by-side</p>
      </header>

      <main className="app-main">
        <section className="upload-section" aria-label="Upload PDFs">
          <PdfUploader
            label="PDF A"
            file={fileA}
            onFileSelected={setFileA}
            disabled={isBusy}
          />
          <div className="vs-badge" aria-hidden="true">VS</div>
          <PdfUploader
            label="PDF B"
            file={fileB}
            onFileSelected={setFileB}
            disabled={isBusy}
          />
        </section>

        <div className="action-bar">
          <button
            className="btn-preview"
            onClick={handlePreview}
            disabled={!canPreview}
            aria-busy={phase === 'rendering'}
          >
            {phase === 'rendering' ? 'Rendering…' : 'Preview Pages'}
          </button>
          <button
            className="btn-compare-regions"
            onClick={handleCompareRegions}
            disabled={!canCompareRegions}
            aria-busy={phase === 'processing'}
            title={!regionA || !regionB ? 'Draw a selection on each side first' : undefined}
          >
            {phase === 'processing' ? 'Processing…' : 'Compare Selected Regions'}
          </button>
          <button
            className="btn-compare"
            onClick={handleCompare}
            disabled={!canCompare}
            aria-busy={phase === 'processing'}
          >
            Compare Full PDFs
          </button>
          {phase !== 'idle' && (
            <button className="btn-reset" onClick={handleReset}>
              Reset
            </button>
          )}
        </div>

        {phase === 'rendering' && (
          <section className="progress-section" aria-label="Render progress" aria-live="polite">
            <OcrProgress {...progressA} />
            <OcrProgress {...progressB} />
          </section>
        )}

        {(phase === 'preview' || phase === 'processing' || phase === 'done') && pagesA.length > 0 && pagesB.length > 0 && (
          <section className="preview-section" aria-label="PDF page preview">
            <div className="preview-toolbar">
              <button
                className="btn-collapse"
                onClick={() => setPreviewExpanded((v) => !v)}
                aria-expanded={previewExpanded}
                aria-controls="preview-content"
              >
                <span className={`collapse-chevron${previewExpanded ? ' expanded' : ''}`}>›</span>
                Preview
              </button>
              {previewExpanded && (
                <label className="sync-toggle">
                  <input
                    type="checkbox"
                    checked={syncPages}
                    onChange={(e) => setSyncPages(e.target.checked)}
                    aria-label="Sync page navigation"
                  />
                  Sync page navigation
                </label>
              )}
            </div>
            <div id="preview-content" className={`preview-viewers${previewExpanded ? '' : ' collapsed'}`}>
              <PdfPageViewer
                label={fileA?.name ?? 'PDF A'}
                pages={pagesA}
                currentPage={currentPageA}
                onPageChange={(p) => {
                  setCurrentPageA(p)
                  if (syncPages) setCurrentPageB(Math.min(p, pagesB.length || 1))
                  setRegionA(null)
                }}
                onRegionChange={setRegionA}
              />
              <PdfPageViewer
                label={fileB?.name ?? 'PDF B'}
                pages={pagesB}
                currentPage={currentPageB}
                onPageChange={(p) => {
                  setCurrentPageB(p)
                  if (syncPages) setCurrentPageA(Math.min(p, pagesA.length || 1))
                  setRegionB(null)
                }}
                onRegionChange={setRegionB}
              />
            </div>
          </section>
        )}

        {phase === 'processing' && (
          <section className="progress-section" aria-label="OCR progress" aria-live="polite">
            <OcrProgress {...progressA} />
            <OcrProgress {...progressB} />
            <p className="progress-note">
              First run downloads ~15 MB of language data — this may take 35–80 s.
            </p>
          </section>
        )}

        {phase === 'error' && (
          <div className="error-banner" role="alert" aria-live="assertive">
            <strong>Error:</strong> {error}
          </div>
        )}

        {phase === 'done' && (
          <section className="diff-section" aria-label="Diff results">
            <ErrorBoundary>
              <Suspense fallback={<div className="diff-loading">Loading diff viewer…</div>}>
                <DiffViewer
                  oldText={textA}
                  newText={textB}
                  oldTitle={fileA?.name ?? 'PDF A'}
                  newTitle={fileB?.name ?? 'PDF B'}
                />
              </Suspense>
            </ErrorBoundary>
          </section>
        )}
      </main>
    </div>
  )
}
