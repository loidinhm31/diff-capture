import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log full cause chain for debugging
    console.error('[ErrorBoundary]', error, info, 'cause:', error.cause)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error)
      return (
        <div className="error-banner" role="alert" aria-live="assertive">
          <strong>Diff rendering failed:</strong>{' '}
          {/* String() coerces non-Error throws (e.g. plain strings) before display */}
          {String(this.state.error.message)}
          <button onClick={this.reset} style={{ marginLeft: '0.75rem' }}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
