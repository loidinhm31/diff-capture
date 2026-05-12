import { useState, useCallback, lazy, Suspense } from 'react'
import { PdfUploader } from './components/PdfUploader'
import { OcrProgress } from './components/OcrProgress'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { OcrProgressEvent } from './utils/ocr-engine'
import './App.css'

// Code-split heavy diff viewer — only loaded after OCR completes
const DiffViewer = lazy(() =>
  import('./components/DiffViewer').then((m) => ({ default: m.DiffViewer }))
)

type Phase = 'idle' | 'processing' | 'done' | 'error'

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

  const canCompare = fileA !== null && fileB !== null && phase !== 'processing'

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
            disabled={phase === 'processing'}
          />
          <div className="vs-badge" aria-hidden="true">VS</div>
          <PdfUploader
            label="PDF B"
            file={fileB}
            onFileSelected={setFileB}
            disabled={phase === 'processing'}
          />
        </section>

        <div className="action-bar">
          <button
            className="btn-compare"
            onClick={handleCompare}
            disabled={!canCompare}
            aria-busy={phase === 'processing'}
          >
            {phase === 'processing' ? 'Processing…' : 'Compare PDFs'}
          </button>
          {phase !== 'idle' && (
            <button className="btn-reset" onClick={handleReset}>
              Reset
            </button>
          )}
        </div>

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
