import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiffViewer } from '../components/DiffViewer'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Mock react-diff-viewer-continued to capture props without rendering its full DOM
vi.mock('react-diff-viewer-continued', () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="diff-viewer-mock"
      data-left-title={String(props.leftTitle)}
      data-right-title={String(props.rightTitle)}
      data-old-value={String(props.oldValue)}
      data-new-value={String(props.newValue)}
      data-split-view={String(props.splitView)}
      data-use-dark-theme={String(props.useDarkTheme)}
    />
  ),
  DiffMethod: { WORDS: 'diffWords' },
}))

describe('DiffViewer', () => {
  it('renders the wrapper container', () => {
    const { container } = render(<DiffViewer oldText="hello" newText="world" />)
    expect(container.querySelector('.diff-viewer')).toBeInTheDocument()
  })

  it('uses default titles PDF A and PDF B', () => {
    render(<DiffViewer oldText="hello" newText="world" />)
    const mock = screen.getByTestId('diff-viewer-mock')
    expect(mock).toHaveAttribute('data-left-title', 'PDF A')
    expect(mock).toHaveAttribute('data-right-title', 'PDF B')
  })

  it('passes custom titles when provided', () => {
    render(
      <DiffViewer oldText="old" newText="new" oldTitle="Document v1" newTitle="Document v2" />
    )
    const mock = screen.getByTestId('diff-viewer-mock')
    expect(mock).toHaveAttribute('data-left-title', 'Document v1')
    expect(mock).toHaveAttribute('data-right-title', 'Document v2')
  })

  it('passes oldText and newText to the underlying viewer', () => {
    render(<DiffViewer oldText="original text" newText="modified text" />)
    const mock = screen.getByTestId('diff-viewer-mock')
    expect(mock).toHaveAttribute('data-old-value', 'original text')
    expect(mock).toHaveAttribute('data-new-value', 'modified text')
  })

  it('renders in split view mode', () => {
    render(<DiffViewer oldText="a" newText="b" />)
    const mock = screen.getByTestId('diff-viewer-mock')
    expect(mock).toHaveAttribute('data-split-view', 'true')
  })

  it('uses light theme by default', () => {
    render(<DiffViewer oldText="a" newText="b" />)
    const mock = screen.getByTestId('diff-viewer-mock')
    expect(mock).toHaveAttribute('data-use-dark-theme', 'false')
  })

  it('handles empty strings without crashing', () => {
    expect(() => render(<DiffViewer oldText="" newText="" />)).not.toThrow()
  })

  it('handles large multipage text and passes it through completely', () => {
    const bigText = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n')
    render(<DiffViewer oldText={bigText} newText={bigText} />)
    const mock = screen.getByTestId('diff-viewer-mock')
    // Verify the full text is passed, not truncated
    expect(mock.getAttribute('data-old-value')).toBe(bigText)
    expect(mock.getAttribute('data-new-value')).toBe(bigText)
  })
})

describe('DiffViewer inside ErrorBoundary', () => {
  it('renders DiffViewer normally wrapped in ErrorBoundary', () => {
    render(
      <ErrorBoundary>
        <DiffViewer oldText="foo" newText="bar" />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('diff-viewer-mock')).toBeInTheDocument()
  })
})
