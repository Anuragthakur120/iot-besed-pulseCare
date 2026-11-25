import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/Button';
import { Mail, User } from 'lucide-react';

export function AcceptInvitePage() {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const token = paramToken || searchParams.get('token') || '';
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Missing invitation token');
      return;
    }

    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/accept-invite', {
        token,
        email,
        name,
        password
      });

      if (res.data?.success) {
        toast.success('Invitation accepted! Please sign in with your new password.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Failed to accept invitation'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Staff Invitation Onboarding"
      subtitle="Complete your clinician profile to activate your hospital terminal access."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        <Input
          label="Invited Email Address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={Mail}
        />

        <Input
          label="Your Full Name"
          type="text"
          placeholder="e.g. Dr. Alex Morgan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={User}
        />

        <PasswordInput
          label="Set Password"
          required
          showStrengthMeter
          placeholder="Min 10 characters with upper, lower, number, symbol"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" variant="primary" isLoading={isLoading} className="w-full mt-2">
          Activate Staff Account
        </Button>
      </form>
    </AuthLayout>
  );
}

export default AcceptInvitePage;
