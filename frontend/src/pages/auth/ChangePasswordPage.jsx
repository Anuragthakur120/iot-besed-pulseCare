import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/services/api';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/Button';
import { ShieldAlert } from 'lucide-react';

export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentPassword || !newPassword) {
      setErrorMessage('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password cannot be the same as your current password');
      return;
    }

    if (newPassword.length < 10) {
      setErrorMessage('New password must be at least 10 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setErrorMessage('New password must contain at least one uppercase letter (A-Z)');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setErrorMessage('New password must contain at least one lowercase letter (a-z)');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setErrorMessage('New password must contain at least one number (0-9)');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setErrorMessage('New password must contain at least one special symbol (!@#$%^&*...)');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully! You may now access the system.');

      if (user?.role === 'doctor' || user?.role === 'admin') {
        navigate('/doctor/dashboard', { replace: true });
      } else {
        navigate('/patient/dashboard', { replace: true });
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Failed to update password'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Change Temporary Password"
      subtitle="For patient safety and compliance, you must change your initial temporary password before continuing."
    >
      <div className="space-y-6">
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Your account currently has a temporary or default password set. Please establish a personal, secure password to unlock full dashboard access.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Current / Temporary Password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <PasswordInput
            label="New Compliant Password"
            required
            showStrengthMeter
            placeholder="Min 10 characters, uppercase, number, symbol"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <PasswordInput
            label="Confirm New Password"
            required
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={logout}
              className="w-1/3"
            >
              Sign Out
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-2/3"
            >
              Update Password
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}

export default ChangePasswordPage;
