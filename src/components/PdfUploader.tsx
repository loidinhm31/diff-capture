import { useRef, useState } from 'react'

interface Props {
  label: string
  onFileSelected: (file: File) => void
  file: File | null
  disabled?: boolean
}

export function PdfUploader({ label, onFileSelected, file, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (f.type !== 'application/pdf') {
      alert('Please select a valid PDF file.')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      alert('File exceeds 50 MB limit.')
      return
    }
    onFileSelected(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={`pdf-uploader${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <div className="uploader-icon">📄</div>
      <div className="uploader-label">{label}</div>
      {file ? (
        <div className="uploader-filename">{file.name}</div>
      ) : (
        <div className="uploader-hint">Click or drag & drop a PDF (max 50 MB)</div>
      )}
    </div>
  )
}
