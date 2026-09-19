import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error, info) {
    console.error('HeroSection Error:', error);
    console.error('Component Stack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <h1 className="text-xl font-bold text-red-600">
              Something went wrong.
            </h1>

            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-900 text-white rounded"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;