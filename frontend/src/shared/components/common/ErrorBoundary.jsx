import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-base-200">
          <div className="card w-full max-w-lg bg-base-100 shadow-xl p-6 text-center">
            <h1 className="text-xl font-bold text-error mb-2">Something went wrong</h1>
            <p className="text-sm text-base-content/70 mb-4">
              An unexpected error occurred while rendering this view.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs bg-base-300 p-3 rounded mb-4 overflow-x-auto text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn btn-primary btn-sm"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
