import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/services/api';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Mail, Stethoscope, User, ShieldAlert, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('patient'); // 'patient' | 'doctor'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [demoOpen, setDemoOpen] = useState(true);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else if (user.role === 'doctor' || user.role === 'admin') {
        navigate('/doctor/dashboard', { replace: true });
      } else {
        navigate('/patient/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email address and password');
      return;
    }

    setIsLoading(true);
    try {
      const loggedUser = await login(cleanEmail, password, rememberMe);
      toast.success(`Welcome back, ${loggedUser.name}!`);

      if (loggedUser.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }

      const intendedPath = location.state?.from?.pathname;
      if (intendedPath) {
        navigate(intendedPath, { replace: true });
      } else if (loggedUser.role === 'doctor' || loggedUser.role === 'admin') {
        navigate('/doctor/dashboard', { replace: true });
      } else {
        navigate('/patient/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = getErrorMessage(err, 'Invalid email or password');
      setErrorMessage(msg);

      if (msg.toLowerCase().includes('locked')) {
        setLockoutSeconds(15 * 60); // 15 min countdown
      }
    } finally {
      setIsLoading(false);
    }
  };

  const autofillDemo = (role) => {
    if (role === 'doctor') {
      setEmail('doctor@pulsecare.dev');
      setPassword('Doctor@Pulse#2026');
      setActiveTab('doctor');
    } else if (role === 'patient') {
      setEmail('patient@pulsecare.dev');
      setPassword('Patient@Pulse#2026');
      setActiveTab('patient');
    } else if (role === 'admin') {
      setEmail('admin@pulsecare.dev');
      setPassword('Admin@Pulse#2026');
      setActiveTab('doctor');
    }
    setErrorMessage('');
  };

  return (
    <AuthLayout
      title={activeTab === 'doctor' ? 'Clinical Staff Portal' : 'Patient Portal Access'}
      subtitle="Sign in with your verified credentials to access live vitals and telemetry."
    >
      <div className="space-y-6">
        {/* Role Toggle Tab */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('patient');
              setErrorMessage('');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              activeTab === 'patient'
                ? 'bg-white dark:bg-[#0c1626] text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Patient Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('doctor');
              setErrorMessage('');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
              activeTab === 'doctor'
                ? 'bg-white dark:bg-[#0c1626] text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Doctor / Operator</span>
          </button>
        </div>

        {/* Lockout Warning Banner */}
        {lockoutSeconds > 0 && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Account Locked</p>
              <p className="mt-0.5">
                Too many consecutive failed login attempts. Retry available in{' '}
                <span className="font-mono font-bold">
                  {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                </span>
                .
              </p>
            </div>
          </div>
        )}

        {/* Inline Error Message */}
        {errorMessage && lockoutSeconds === 0 && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            required
            autoComplete="email"
            placeholder={activeTab === 'doctor' ? 'doctor@pulsecare.dev' : 'patient@pulsecare.dev'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={Mail}
          />

          <PasswordInput
            label="Password"
            required
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex items-center justify-between text-xs pt-1">
            <Checkbox
              id="remember-device"
              label="Remember this device (7 days)"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <Link
              to="/forgot-password"
              className="text-teal-600 dark:text-teal-400 hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant={activeTab === 'doctor' ? 'secondary' : 'primary'}
            isLoading={isLoading}
            disabled={lockoutSeconds > 0}
            className="w-full mt-2"
          >
            {activeTab === 'doctor' ? 'Authenticate as Clinician' : 'Sign In to Patient Portal'}
          </Button>
        </form>

        {/* Signup Redirect for Patients */}
        {activeTab === 'patient' && (
          <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-[#E5EAF1] dark:border-slate-800">
            Don't have a patient account?{' '}
            <Link to="/signup" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
              Register as Patient
            </Link>
          </div>
        )}

        {/* DEV ONLY Collapsible Demo Credentials Box (Never exists in production) */}
        {import.meta.env.DEV && (
          <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDemoOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1"
            >
              <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> DEV DEMO CREDENTIALS
              </span>
              {demoOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {demoOpen && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[#E5EAF1] dark:border-slate-800 space-y-2 text-xs">
                <p className="text-[11px] text-slate-500">
                  Click below to autofill seeded development credentials:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => autofillDemo('doctor')}
                    className="px-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium hover:bg-blue-500/20 text-[11px] transition-colors"
                  >
                    Seeded Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => autofillDemo('patient')}
                    className="px-2 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-medium hover:bg-teal-500/20 text-[11px] transition-colors"
                  >
                    Seeded Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => autofillDemo('admin')}
                    className="px-2 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium hover:bg-purple-500/20 text-[11px] transition-colors"
                  >
                    Seeded Admin
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
