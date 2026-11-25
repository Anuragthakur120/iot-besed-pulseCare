import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#070e19] text-[#0B1F3A] dark:text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Clinical Application Alert</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 mb-6 leading-relaxed">
            An unexpected client render state was encountered. Clinical records on the server remain intact.
          </p>
          <Button variant="primary" onClick={this.handleReload} leftIcon={RefreshCw}>
            Reload PulseCare Terminal
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
