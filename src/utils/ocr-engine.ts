import { createWorker } from 'tesseract.js'

export interface OcrProgressEvent {
  status: string
  progress: number
}

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>

/** Maximum time (ms) allowed for a single page OCR before aborting. */
const PAGE_TIMEOUT_MS = 30_000

let workerInstance: TesseractWorker | null = null
// Serializes concurrent calls so the singleton worker is never shared simultaneously
let currentTask: Promise<unknown> = Promise.resolve()

async function getWorker(): Promise<TesseractWorker> {
  if (!workerInstance) {
    workerInstance = await createWorker('eng')
  }
  return workerInstance
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`OCR timed out after ${ms / 1000}s`)), ms),
    ),
  ])
}

export async function extractTextFromCanvases(
  canvases: HTMLCanvasElement[],
  onProgress?: (event: OcrProgressEvent) => void
): Promise<string> {
  const task = currentTask.then(async () => {
    const worker = await getWorker()
    const texts: string[] = []

    for (let i = 0; i < canvases.length; i++) {
      onProgress?.({
        status: `OCR page ${i + 1} of ${canvases.length}`,
        progress: i / canvases.length,
      })

      try {
        const result = await withTimeout(worker.recognize(canvases[i]), PAGE_TIMEOUT_MS)
        texts.push(result.data.text)
      } catch (err) {
        throw new Error(
          `OCR failed on page ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          { cause: err }
        )
      }
    }

    onProgress?.({ status: 'Done', progress: 1 })
    return texts.join('\n\n--- Page Break ---\n\n')
  })

  // Both callbacks return undefined so that a task failure does not reject
  // currentTask itself — keeping the queue unblocked for subsequent callers.
  // The original caller still receives the rejection via `task`.
  currentTask = task.then(
    () => undefined,
    () => undefined,
  )

  return task as Promise<string>
}

export async function terminateOcrWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
  }
  currentTask = Promise.resolve()
}
