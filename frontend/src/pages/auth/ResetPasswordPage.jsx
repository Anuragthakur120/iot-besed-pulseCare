import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import api, { getErrorMessage } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/Button';
import { CheckCircle2, Mail, Key } from 'lucide-react';

export function ResetPasswordPage() {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const token = paramToken || searchParams.get('token') || '';
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Missing password reset security token');
      return;
    }

    if (newPassword.length < 10) {
      setErrorMessage('New password must be at least 10 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/reset-password', {
        token,
        email,
        newPassword
      });

      if (res.data?.success) {
        setIsSuccess(true);
        toast.success('Your password has been successfully reset.');
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create New Password"
      subtitle="Choose a strong, compliant password to restore access to your clinical records."
    >
      <div className="space-y-6">
        {isSuccess ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-12 h-12 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#0B1F3A] dark:text-white">Password Updated</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                Your password has been securely updated. You can now sign in with your new credentials.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate('/login')}
              className="w-full mt-2"
            >
              Sign In to Your Account
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <Input
              label="Account Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={Mail}
            />

            <PasswordInput
              label="New Secure Password"
              required
              showStrengthMeter
              placeholder="Min 10 characters with upper, lower, number, symbol"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <Button type="submit" variant="primary" isLoading={isLoading} className="w-full mt-2">
              Confirm & Save Password
            </Button>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-slate-500 hover:underline">
                Cancel and return to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
