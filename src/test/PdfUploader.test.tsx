import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PdfUploader } from '../components/PdfUploader'

describe('PdfUploader', () => {
  const onFileSelected = vi.fn()

  beforeEach(() => {
    onFileSelected.mockClear()
  })

  it('renders label and hint when no file', () => {
    render(
      <PdfUploader label="PDF A" file={null} onFileSelected={onFileSelected} />
    )
    expect(screen.getByText('PDF A')).toBeInTheDocument()
    expect(screen.getByText(/click or drag/i)).toBeInTheDocument()
  })

  it('shows filename when file is selected', () => {
    const file = new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' })
    render(
      <PdfUploader label="PDF B" file={file} onFileSelected={onFileSelected} />
    )
    expect(screen.getByText('sample.pdf')).toBeInTheDocument()
  })

  it('rejects non-PDF files with alert', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(
      <PdfUploader label="PDF A" file={null} onFileSelected={onFileSelected} />
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const notPdf = new File(['data'], 'image.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [notPdf] } })
    expect(alertMock).toHaveBeenCalledWith('Please select a valid PDF file.')
    expect(onFileSelected).not.toHaveBeenCalled()
    alertMock.mockRestore()
  })

  it('rejects files over 50 MB with alert', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(
      <PdfUploader label="PDF A" file={null} onFileSelected={onFileSelected} />
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = new File(['x'.repeat(1024)], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [bigFile] } })
    expect(alertMock).toHaveBeenCalledWith('File exceeds 50 MB limit.')
    expect(onFileSelected).not.toHaveBeenCalled()
    alertMock.mockRestore()
  })

  it('calls onFileSelected with valid PDF', () => {
    render(
      <PdfUploader label="PDF A" file={null} onFileSelected={onFileSelected} />
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const pdfFile = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdfFile] } })
    expect(onFileSelected).toHaveBeenCalledWith(pdfFile)
  })

  it('disables upload when disabled prop is true', () => {
    render(
      <PdfUploader label="PDF A" file={null} onFileSelected={onFileSelected} disabled />
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeDisabled()
  })
})
