import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage, api } from '@/services/api';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { FileUploader } from '@/components/FileUploader';
import { Mail, User, Phone, Calendar, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

export function SignupPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const handlePhotoSelect = (file) => {
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setErrorMessage('Please complete all required fields');
      return;
    }

    if (cleanName.length < 2) {
      setErrorMessage('Full name must be at least 2 characters long');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    // Comprehensive Password Policy Enforcement
    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters long');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setErrorMessage('Password must contain at least one uppercase letter (A-Z)');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setErrorMessage('Password must contain at least one lowercase letter (a-z)');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setErrorMessage('Password must contain at least one number (0-9)');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setErrorMessage('Password must contain at least one special symbol (!@#$%^&*...)');
      return;
    }
    if (password.toLowerCase() === cleanEmail) {
      setErrorMessage('Password cannot be identical to your email address');
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!dob) {
      setErrorMessage('Please provide your date of birth');
      return;
    }

    if (!consent) {
      setErrorMessage('You must accept the telemetry monitoring consent to register');
      return;
    }

    setIsLoading(true);
    try {
      const patient = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        dob,
        phone: phone.trim(),
        consent: true
      });

      // Upload profile photo if patient selected one
      if (photoFile && patient?.patientId) {
        try {
          const formData = new FormData();
          formData.append('photo', photoFile);
          await api.post(`/api/patients/${patient.patientId}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (_photoErr) {
          console.warn('[Signup] Optional profile image upload failed:', _photoErr);
        }
      }

      toast.success(`Registration successful! Your Patient ID is ${patient.patientId}`);
      navigate('/patient/dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Registration failed. Please check your credentials and try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Patient Account"
      subtitle={
        step === 1
          ? 'Step 1 of 2: Account Security & Login Details'
          : 'Step 2 of 2: Patient Profile & Clinical Telemetry Consent'
      }
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              step >= 1 ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />
          <div
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              step >= 2 ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleNextStep} className="space-y-4">
            <Input
              label="Full Legal Name"
              required
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={User}
            />

            <Input
              label="Email Address"
              type="email"
              required
              placeholder="patient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={Mail}
            />

            <PasswordInput
              label="Account Password"
              required
              showStrengthMeter
              placeholder="Min 10 characters, upper, lower, number, symbol"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" variant="primary" className="w-full mt-4" rightIcon={ArrowRight}>
              Continue to Step 2
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Date of Birth"
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              leftIcon={Calendar}
            />

            <Input
              label="Contact Phone Number"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={Phone}
            />

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-[#0B1F3A] dark:text-slate-200">
                Patient Photo (Optional)
              </label>
              <FileUploader
                previewUrl={photoPreview}
                onFileSelect={handlePhotoSelect}
                onRemove={() => {
                  setPhotoFile(null);
                  setPhotoPreview(null);
                }}
              />
            </div>

            <div className="pt-2">
              <Checkbox
                id="consent-checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                label={
                  <span>
                    I consent to real-time hospital telemetry recording and accept the{' '}
                    <span className="text-teal-600 dark:text-teal-400 font-semibold underline">
                      Hospital Telemetry Privacy Policy
                    </span>
                    .
                  </span>
                }
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                leftIcon={ArrowLeft}
                className="w-1/3"
              >
                Back
              </Button>
              <Button type="submit" variant="primary" isLoading={isLoading} className="w-2/3">
                Complete Registration
              </Button>
            </div>
          </form>
        )}

        <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-[#E5EAF1] dark:border-slate-800">
          Already registered?{' '}
          <Link to="/login" className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default SignupPage;
