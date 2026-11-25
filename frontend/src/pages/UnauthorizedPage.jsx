import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';

export function UnauthorizedPage() {
  const { user } = useAuth();
  const returnPath = user?.role === 'patient' ? '/patient/dashboard' : '/doctor/dashboard';

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#070e19] text-[#0B1F3A] dark:text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
        <ShieldX className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight">403 - Access Prohibited</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 mb-6 leading-relaxed">
        You do not possess clinical authorization to view this medical record or hospital terminal page. Patient isolation protocols are strictly enforced.
      </p>
      <Link to={user ? returnPath : '/login'}>
        <Button variant="primary" leftIcon={ArrowLeft}>
          Return to My Dashboard
        </Button>
      </Link>
    </div>
  );
}

export default UnauthorizedPage;
