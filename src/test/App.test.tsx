import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'

// ---------------------------------------------------------------------------
// Library-level safety-net mocks (prevent DOMMatrix / Node.js env errors)
// ---------------------------------------------------------------------------
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn(async () => ({
        getViewport: vi.fn(() => ({ width: 400, height: 300 })),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
      })),
    }),
  })),
}))

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: vi.fn(async () => ({ data: { text: 'Extracted text' } })),
    terminate: vi.fn(async () => {}),
  })),
}))

// jsdom stub for canvas rendering
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => ({
    drawImage: vi.fn(), fillRect: vi.fn(), clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(), createImageData: vi.fn(), setTransform: vi.fn(),
    save: vi.fn(), restore: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
    translate: vi.fn(), transform: vi.fn(), beginPath: vi.fn(),
    closePath: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(),
  })),
  writable: true,
})

// ---------------------------------------------------------------------------
// Utility-level mocks (control return values per-test)
// ---------------------------------------------------------------------------
vi.mock('../utils/pdf-renderer', () => ({
  renderPdfToCanvases: vi.fn(),
}))

vi.mock('../utils/ocr-engine', () => ({
  extractTextFromCanvases: vi.fn(),
  terminateOcrWorker: vi.fn().mockResolvedValue(undefined),
}))

// Mock DiffViewer — avoid loading react-diff-viewer-continued in integration tests
vi.mock('../components/DiffViewer', () => ({
  DiffViewer: ({
    oldText,
    newText,
    oldTitle,
    newTitle,
  }: {
    oldText: string
    newText: string
    oldTitle?: string
    newTitle?: string
  }) => (
    <div
      data-testid="diff-viewer"
      data-old-title={oldTitle}
      data-new-title={newTitle}
    >
      <span data-testid="old-text">{oldText}</span>
      <span data-testid="new-text">{newText}</span>
    </div>
  ),
}))

// Mock RegionSelector — avoid canvas/ResizeObserver complexity in App integration tests
vi.mock('../components/RegionSelector', () => ({
  RegionSelector: ({ pageNum }: { pageNum: number }) => (
    <div data-testid={`region-selector-${pageNum}`} />
  ),
}))

import { renderPdfToCanvases } from '../utils/pdf-renderer'
import { extractTextFromCanvases } from '../utils/ocr-engine'

function makePdfFile(name: string) {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

function selectFiles(fileA: File, fileB: File) {
  const inputs = document.querySelectorAll('input[type="file"]')
  fireEvent.change(inputs[0], { target: { files: [fileA] } })
  fireEvent.change(inputs[1], { target: { files: [fileB] } })
}

beforeEach(() => {
  vi.mocked(renderPdfToCanvases).mockResolvedValue([
    { pageNum: 1, canvas: document.createElement('canvas') },
  ])
  vi.mocked(extractTextFromCanvases).mockResolvedValue('Extracted text')
})

describe('App — initial state', () => {
  it('renders header and subtitle', () => {
    render(<App />)
    expect(screen.getByText('PDF OCR Compare')).toBeInTheDocument()
    expect(screen.getByText(/extract text from pdfs/i)).toBeInTheDocument()
  })

  it('renders two PDF uploaders', () => {
    render(<App />)
    expect(screen.getByText('PDF A')).toBeInTheDocument()
    expect(screen.getByText('PDF B')).toBeInTheDocument()
  })

  it('Compare button is disabled with no files', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /compare full pdfs/i })).toBeDisabled()
  })

  it('Reset button is absent in idle state', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
  })
})

describe('App — file selection', () => {
  it('enables Compare button after both files are selected', () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    expect(screen.getByRole('button', { name: /compare full pdfs/i })).not.toBeDisabled()
  })

  it('keeps Compare button disabled when only one file is selected', () => {
    render(<App />)
    const inputs = document.querySelectorAll('input[type="file"]')
    fireEvent.change(inputs[0], { target: { files: [makePdfFile('a.pdf')] } })
    expect(screen.getByRole('button', { name: /compare full pdfs/i })).toBeDisabled()
  })
})

describe('App — comparison flow', () => {
  it('shows processing state while OCR runs', async () => {
    let resolveA: (v: string) => void
    vi.mocked(extractTextFromCanvases).mockImplementationOnce(
      () => new Promise((resolve) => { resolveA = resolve })
    )
    vi.mocked(extractTextFromCanvases).mockResolvedValueOnce('Text B')

    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument()
    })

    resolveA!('Text A')
    // Clean up: wait for done or timeout
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /processing/i })).not.toBeInTheDocument()
    })
  })

  it('renders diff viewer after successful comparison', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
    })
    // Both panels should receive non-empty text
    expect(screen.getByTestId('old-text').textContent).toBeTruthy()
    expect(screen.getByTestId('new-text').textContent).toBeTruthy()
  })

  it('passes filenames as titles to DiffViewer', async () => {
    render(<App />)
    selectFiles(makePdfFile('contract.pdf'), makePdfFile('revised.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      const viewer = screen.getByTestId('diff-viewer')
      expect(viewer).toHaveAttribute('data-old-title', 'contract.pdf')
      expect(viewer).toHaveAttribute('data-new-title', 'revised.pdf')
    })
  })

  it('shows Reset button after comparison completes', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
    })
  })
})

describe('App — error handling', () => {
  it('shows error banner when PDF rendering fails', async () => {
    vi.mocked(renderPdfToCanvases).mockRejectedValueOnce(
      new Error('Failed to load PDF: corrupted file')
    )

    render(<App />)
    selectFiles(makePdfFile('bad.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText(/Failed to load PDF/)).toBeInTheDocument()
  })

  it('shows error banner when OCR fails', async () => {
    vi.mocked(extractTextFromCanvases).mockRejectedValueOnce(
      new Error('OCR service unavailable')
    )

    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/OCR service unavailable/)).toBeInTheDocument()
    })
  })

  it('error banner has aria-live="assertive" for screen readers', async () => {
    vi.mocked(extractTextFromCanvases).mockRejectedValueOnce(new Error('Fail'))

    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
    })
  })
})

describe('App — reset', () => {
  it('resets to idle state and hides diff viewer', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))

    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /compare full pdfs/i })).toBeDisabled()
  })

  it('hides Reset button after reset', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
  })

  it('allows re-comparison after reset', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /compare full pdfs/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    selectFiles(makePdfFile('c.pdf'), makePdfFile('d.pdf'))
    expect(screen.getByRole('button', { name: /compare full pdfs/i })).not.toBeDisabled()
  })
})

describe('App — preview flow', () => {
  it('Preview Pages button is disabled with no files', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /preview pages/i })).toBeDisabled()
  })

  it('Preview Pages button enables after both files selected', () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    expect(screen.getByRole('button', { name: /preview pages/i })).not.toBeDisabled()
  })

  it('renders two PDF page viewers after preview', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /preview pages/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('PDF page preview')).toBeInTheDocument()
      expect(document.querySelectorAll('.pdf-page-viewer').length).toBe(2)
    })
  })

  it('shows page navigation controls in preview mode', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /preview pages/i }))

    await waitFor(() => {
      expect(screen.getAllByLabelText(/previous page/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByLabelText(/next page/i).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows error banner if PDF rendering fails during preview', async () => {
    vi.mocked(renderPdfToCanvases).mockRejectedValueOnce(
      new Error('Failed to render PDF')
    )

    render(<App />)
    selectFiles(makePdfFile('bad.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /preview pages/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Failed to render PDF/)).toBeInTheDocument()
    })
  })

  it('reset clears preview and returns to idle', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /preview pages/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('PDF page preview')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))
    expect(screen.queryByLabelText('PDF page preview')).not.toBeInTheDocument()
  })
})

describe('App — sync page navigation', () => {
  it('shows sync toggle in preview mode', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /preview pages/i }))

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /sync page navigation/i })).toBeInTheDocument()
    })
  })

  it('sync checkbox is unchecked by default', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /preview pages/i }))

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /sync page navigation/i })).not.toBeChecked()
    })
  })

  it('sync checkbox can be toggled on and off', async () => {
    render(<App />)
    selectFiles(makePdfFile('a.pdf'), makePdfFile('b.pdf'))
    fireEvent.click(screen.getByRole('button', { name: /preview pages/i }))

    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: /sync page navigation/i })
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
      fireEvent.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })
  })
})
