import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'

// A component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error message')
  return <div>Safe content</div>
}

// Wrapper that lets us toggle the child's error state from outside the boundary
function ToggleWrapper() {
  const [throws, setThrows] = useState(true)
  return (
    <>
      <button onClick={() => setThrows(false)}>Fix error</button>
      <ErrorBoundary>
        <ThrowingChild shouldThrow={throws} />
      </ErrorBoundary>
    </>
  )
}

// Suppress React error boundary console output for all tests in this file
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Safe content')).toBeInTheDocument()
  })

  it('renders default error banner when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Diff rendering failed:/)).toBeInTheDocument()
    expect(screen.getByText(/Test error message/)).toBeInTheDocument()
  })

  it('renders custom fallback when provided and child throws', () => {
    const fallback = (err: Error) => <p>Custom: {err.message}</p>
    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom: Test error message')).toBeInTheDocument()
    expect(screen.queryByText(/Diff rendering failed:/)).not.toBeInTheDocument()
  })

  it('default error banner has error-banner class', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    )
    expect(container.querySelector('.error-banner')).toBeInTheDocument()
  })

  it('logs error details to console.error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    )
    expect(console.error).toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.any(Error),
      expect.anything(),
      'cause:',
      undefined
    )
  })

  it('renders a Try again button in the default error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('resets error state and re-renders children when Try again is clicked', () => {
    render(<ToggleWrapper />)

    // Initial state: boundary catches the error
    expect(screen.getByText(/Diff rendering failed:/)).toBeInTheDocument()

    // Fix the underlying cause (state change outside the boundary)
    fireEvent.click(screen.getByRole('button', { name: /fix error/i }))

    // Click Try again — boundary clears its internal error state
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    // Child no longer throws → safe content visible
    expect(screen.getByText('Safe content')).toBeInTheDocument()
    expect(screen.queryByText(/Diff rendering failed:/)).not.toBeInTheDocument()
  })
})
