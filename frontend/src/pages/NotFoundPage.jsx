import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#070e19] text-[#0B1F3A] dark:text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight">404 - Page Not Found</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 mb-6 leading-relaxed">
        The clinical terminal path or patient record you requested could not be located on the server.
      </p>
      <Link to="/">
        <Button variant="primary" leftIcon={ArrowLeft}>
          Return to Hospital Home
        </Button>
      </Link>
    </div>
  );
}

export default NotFoundPage;
