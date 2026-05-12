import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OcrProgress } from '../components/OcrProgress'

describe('OcrProgress', () => {
  it('renders label and status', () => {
    render(<OcrProgress label="PDF A" status="Rendering page 1/3" progress={0.33} />)
    expect(screen.getByText('PDF A')).toBeInTheDocument()
    expect(screen.getByText('Rendering page 1/3')).toBeInTheDocument()
  })

  it('displays correct percentage', () => {
    render(<OcrProgress label="PDF B" status="OCR page 2 of 4" progress={0.5} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('shows 0% at start', () => {
    render(<OcrProgress label="PDF A" status="" progress={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('shows 100% when done', () => {
    render(<OcrProgress label="PDF A" status="Done" progress={1} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('progress bar fill width matches percentage', () => {
    const { container } = render(
      <OcrProgress label="PDF A" status="Processing" progress={0.75} />
    )
    const fill = container.querySelector('.ocr-progress-bar-fill') as HTMLElement
    expect(fill.style.width).toBe('75%')
  })
})
