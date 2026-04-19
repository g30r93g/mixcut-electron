import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40,
          fontFamily: 'JetBrains Mono, monospace',
          color: '#e0e0e0',
          backgroundColor: '#1a1a1a',
          height: '100vh',
          overflow: 'auto',
        }}>
          <h1 style={{ color: '#ff5050', fontSize: 16, marginBottom: 12 }}>
            Something went wrong
          </h1>
          <pre style={{
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#ff8080',
            marginBottom: 16,
          }}>
            {this.state.error.message}
          </pre>
          <pre style={{
            fontSize: 11,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#888',
          }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              fontSize: 12,
              background: '#333',
              color: '#e0e0e0',
              border: '1px solid #555',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Try to recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
