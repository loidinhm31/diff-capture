interface Props {
  label: string
  status: string
  progress: number // 0–1
}

export function OcrProgress({ label, status, progress }: Props) {
  const pct = Math.round(progress * 100)

  return (
    <div className="ocr-progress">
      <div className="ocr-progress-label">{label}</div>
      <div className="ocr-progress-status">{status}</div>
      <div className="ocr-progress-bar-track">
        <div className="ocr-progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ocr-progress-pct">{pct}%</div>
    </div>
  )
}
