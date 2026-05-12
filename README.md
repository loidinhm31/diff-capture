# Compare-Diff Tool

PDF OCR Compare-Diff Tool: Extract text from PDF pages using Tesseract.js OCR and compare differences between documents.

**Tech Stack:** React 19 + TypeScript + Vite | PDF.js | Tesseract.js OCR

## Features

- **PDF Upload & Rendering**: Load PDFs and render pages as canvases
- **OCR Engine** (Phase 3): Reliable text extraction with concurrency safety, timeout guards, and detailed error context
- **Diff Viewer**: Side-by-side comparison of extracted text

## Setup

```bash
npm install
npm run dev      # Start dev server
npm test         # Run tests
npm run coverage # Coverage report
```

## Phase 3: OCR Engine

The OCR engine (`src/utils/ocr-engine.ts`) extracts text from PDF pages using Tesseract.js with production-grade reliability:

### Architecture

| Feature | Details |
|---------|---------|
| **Singleton Worker** | Single reusable Tesseract worker (lazy-initialized) minimizes memory overhead |
| **Serialization Queue** | Promise-chaining lock (`currentTask`) prevents concurrent `Promise.all` callers from sharing the worker simultaneously |
| **Per-Page Timeout** | 30-second timeout guard (`Promise.race`) protects against hung OCR operations |
| **Error Context** | Page-specific error wrapping includes page number and original error message |

### API

```typescript
// Extract text from canvas array with optional progress callback
async function extractTextFromCanvases(
  canvases: HTMLCanvasElement[],
  onProgress?: (event: OcrProgressEvent) => void
): Promise<string>

// Shutdown worker and reset queue
async function terminateOcrWorker(): Promise<void>
```

### Example Usage

```typescript
import { extractTextFromCanvases, terminateOcrWorker } from './utils/ocr-engine'

const result = await extractTextFromCanvases(canvases, (progress) => {
  console.log(`${progress.status} - ${Math.round(progress.progress * 100)}%`)
})

await terminateOcrWorker()
```

### Test Coverage

9 tests covering:
- Happy path: multi-page extraction, text concatenation, page break formatting
- Progress events: intermediate callbacks, completion status
- Singleton behavior: worker reuse across calls, initialization once
- Edge cases: empty array, concurrent serialization, error wrapping, 30s timeout

**Run tests:** `npm test` (29/29 passing)

## Directory Structure

```
src/
├── components/      # React UI components
├── utils/
│   └── ocr-engine.ts          # OCR engine (Phase 3)
├── test/
│   └── ocr-engine.test.ts     # OCR engine tests
├── App.tsx          # Main app component
└── main.tsx         # Entry point
```
